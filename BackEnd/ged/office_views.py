"""Telechargement GED pour ONLYOFFICE (jeton signe + schema tenant)."""

from django.core.files.base import ContentFile
from django.core.signing import BadSignature, SignatureExpired
from django.http import FileResponse, Http404, HttpResponseNotFound, JsonResponse
from django.utils.decorators import method_decorator
from django.views.decorators.clickjacking import xframe_options_exempt
from django_tenants.utils import schema_context
import requests
from rest_framework.permissions import AllowAny
from rest_framework.views import APIView

from .models import Document
from .onlyoffice import office_file_token_parse


@method_decorator(xframe_options_exempt, name="dispatch")
class GedOfficeFileDownloadView(APIView):
    """GET /api/ged/office-file/?t=... — accessible depuis le Document Server (Host interne)."""

    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request):
        raw = request.query_params.get("t")
        if not raw:
            return HttpResponseNotFound()
        try:
            doc_id, schema_name = office_file_token_parse(raw)
        except (BadSignature, SignatureExpired):
            return HttpResponseNotFound()

        with schema_context(schema_name):
            doc = Document.objects.filter(pk=doc_id).first()
            if not doc or not doc.file:
                raise Http404()
            f = doc.file.open("rb")
            ct = (doc.mime_type or "application/octet-stream").strip() or "application/octet-stream"
            resp = FileResponse(f, content_type=ct)
            resp["Content-Disposition"] = 'inline; filename="' + (doc.original_filename or doc.title or "file").replace('"', "") + '"'
            return resp


class GedOfficeCallbackView(APIView):
    """POST /api/ged/office-callback/?t=... — persiste les editions ONLYOFFICE."""

    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        raw = request.query_params.get("t")
        if not raw:
            return JsonResponse({"error": 1})
        try:
            doc_id, schema_name = office_file_token_parse(raw)
        except (BadSignature, SignatureExpired):
            return JsonResponse({"error": 1})

        payload = request.data if isinstance(request.data, dict) else {}
        status = int(payload.get("status") or 0)

        # Statuts de sauvegarde ONLYOFFICE (2/3 + forcesave 6/7).
        if status not in {2, 3, 6, 7}:
            return JsonResponse({"error": 0})

        file_url = (payload.get("url") or "").strip()
        if not file_url:
            return JsonResponse({"error": 0})

        with schema_context(schema_name):
            doc = Document.objects.filter(pk=doc_id).first()
            if not doc:
                return JsonResponse({"error": 1})
            old_name = doc.file.name if doc.file else f"ged/{doc_id}.bin"
            try:
                response = requests.get(file_url, timeout=60)
                response.raise_for_status()
                content = response.content
                if not content:
                    return JsonResponse({"error": 1})
                storage = doc.file.storage
                if old_name and storage.exists(old_name):
                    storage.delete(old_name)
                saved_name = storage.save(old_name, ContentFile(content))
                doc.file.name = saved_name
                doc.file_size = len(content)
                ctype = (response.headers.get("Content-Type", "").split(";")[0] or "").strip()
                if ctype:
                    doc.mime_type = ctype
                doc.save()
            except Exception:
                return JsonResponse({"error": 1})
        return JsonResponse({"error": 0})
