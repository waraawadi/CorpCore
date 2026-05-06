from __future__ import annotations

from django.core.files.base import ContentFile
from django.core.signing import BadSignature, SignatureExpired
from django.http import FileResponse, Http404, HttpResponseNotFound, JsonResponse
import requests
from django_tenants.utils import schema_context
from rest_framework.permissions import AllowAny
from rest_framework.views import APIView

from .file_preview import project_file_token_parse
from .models import ProjectAttachment, TaskAttachment


def _resolve_attachment(kind: str, attachment_id: str):
    if kind == "project":
        return ProjectAttachment.objects.filter(pk=attachment_id).first()
    if kind == "task":
        return TaskAttachment.objects.filter(pk=attachment_id).first()
    return None


class ProjectFilePreviewView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request):
        raw = request.query_params.get("t")
        if not raw:
            return HttpResponseNotFound()
        try:
            kind, attachment_id, schema_name = project_file_token_parse(raw)
        except (BadSignature, SignatureExpired):
            return HttpResponseNotFound()
        with schema_context(schema_name):
            att = _resolve_attachment(kind, attachment_id)
            if not att or not att.file:
                raise Http404()
            f = att.file.open("rb")
            ct = (att.mime_type or "application/octet-stream").strip() or "application/octet-stream"
            resp = FileResponse(f, content_type=ct)
            resp["Content-Disposition"] = 'inline; filename="' + (att.name or "file").replace('"', "") + '"'
            return resp


class ProjectFileCallbackView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        raw = request.query_params.get("t")
        if not raw:
            return JsonResponse({"error": 1})
        try:
            kind, attachment_id, schema_name = project_file_token_parse(raw)
        except (BadSignature, SignatureExpired):
            return JsonResponse({"error": 1})

        payload = request.data if isinstance(request.data, dict) else {}
        status = int(payload.get("status") or 0)
        if status not in {2, 3, 6, 7}:
            return JsonResponse({"error": 0})

        file_url = (payload.get("url") or "").strip()
        if not file_url:
            return JsonResponse({"error": 0})

        with schema_context(schema_name):
            att = _resolve_attachment(kind, attachment_id)
            if not att:
                return JsonResponse({"error": 1})
            old_name = att.file.name if att.file else f"projects/{attachment_id}.bin"
            try:
                response = requests.get(file_url, timeout=60)
                response.raise_for_status()
                content = response.content
                if not content:
                    return JsonResponse({"error": 1})
                storage = att.file.storage
                if old_name and storage.exists(old_name):
                    storage.delete(old_name)
                saved_name = storage.save(old_name, ContentFile(content))
                att.file.name = saved_name
                att.file_size = len(content)
                ctype = (response.headers.get("Content-Type", "").split(";")[0] or "").strip()
                if ctype:
                    att.mime_type = ctype
                att.save()
            except Exception:
                return JsonResponse({"error": 1})
        return JsonResponse({"error": 0})
