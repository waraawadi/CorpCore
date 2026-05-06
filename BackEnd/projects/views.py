from urllib.parse import quote
import mimetypes

from django.conf import settings
from django.core.files.base import ContentFile
from django.db import connection
from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import decorators, permissions, response, status, viewsets
from rest_framework.exceptions import PermissionDenied
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser

from ged.access import can_view_document
from ged.models import Document as GedDocument

from .file_preview import (
    build_onlyoffice_config_for_attachment,
    jwt_sign_onlyoffice_config,
    onlyoffice_document_type_for_ext,
    project_file_token,
    extension_from_name_mime,
)
from .models import InAppNotification, Milestone, Project, ProjectAttachment, Sprint, SubTask, Task, TaskAttachment, TaskComment, TaskDependency, Team, TimeEntry
from .permissions import IsProjectReadOrMemberWrite
from .serializers import (
    MilestoneSerializer,
    ProjectSerializer,
    ProjectAttachmentSerializer,
    SprintSerializer,
    SubTaskSerializer,
    TaskAttachmentSerializer,
    TaskCommentSerializer,
    TaskDependencySerializer,
    TaskSerializer,
    TeamSerializer,
    InAppNotificationSerializer,
    TimeEntrySerializer,
)


def _user_can_access_project(user, project: Project) -> bool:
    if user.is_staff or user.is_superuser:
        return True
    if project.owner_id == user.id:
        return True
    return project.members.filter(id=user.id).exists()


def _copy_ged_document_to_storage(ged_doc: GedDocument, *, preferred_name: str | None = None):
    if not ged_doc.file:
        raise ValueError("missing_file")
    filename = (preferred_name or ged_doc.original_filename or ged_doc.title or "document").strip()
    if not filename:
        filename = "document"
    content = ged_doc.file.read()
    if not content:
        raise ValueError("empty_file")
    mime = (ged_doc.mime_type or "").strip()
    if not mime and filename:
        mime = mimetypes.guess_type(filename)[0] or ""
    return filename, mime, len(content), ContentFile(content)


class ProjectScopedViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated, IsProjectReadOrMemberWrite]

    def get_project_id(self):
        return self.request.query_params.get("project")


class ProjectViewSet(viewsets.ModelViewSet):
    serializer_class = ProjectSerializer
    permission_classes = [permissions.IsAuthenticated, IsProjectReadOrMemberWrite]

    def get_queryset(self):
        return (
            Project.objects.filter(Q(owner=self.request.user) | Q(members=self.request.user))
            .distinct()
            .prefetch_related("members", "tasks")
        )

    def perform_create(self, serializer):
        project = serializer.save(owner=self.request.user)
        project.members.add(self.request.user)

    @decorators.action(detail=True, methods=["get"])
    def dashboard(self, request, pk=None):
        project = self.get_object()
        tasks = project.tasks.all()
        stats = tasks.aggregate(
            total=Count("id"),
            done=Count("id", filter=Q(status=Task.STATUS_DONE)),
            in_progress=Count("id", filter=Q(status=Task.STATUS_IN_PROGRESS)),
            review=Count("id", filter=Q(status=Task.STATUS_REVIEW)),
        )
        return response.Response(
            {
                "project_id": project.id,
                "total_tasks": stats["total"],
                "done_tasks": stats["done"],
                "in_progress_tasks": stats["in_progress"],
                "review_tasks": stats["review"],
                "completion_rate": round((stats["done"] / stats["total"]) * 100, 2) if stats["total"] else 0,
            }
        )


class TeamViewSet(viewsets.ModelViewSet):
    serializer_class = TeamSerializer
    permission_classes = [permissions.IsAuthenticated, IsProjectReadOrMemberWrite]

    def get_queryset(self):
        return Team.objects.prefetch_related("members", "projects").select_related("leader").all()


class TaskViewSet(ProjectScopedViewSet):
    serializer_class = TaskSerializer

    def get_queryset(self):
        qs = Task.objects.select_related("project", "assignee").prefetch_related("subtasks", "comments", "attachments")
        project_id = self.get_project_id()
        if project_id:
            qs = qs.filter(project_id=project_id)
        return qs.filter(Q(project__owner=self.request.user) | Q(project__members=self.request.user)).distinct()


class SprintViewSet(ProjectScopedViewSet):
    serializer_class = SprintSerializer

    def get_queryset(self):
        qs = Sprint.objects.select_related("project")
        project_id = self.get_project_id()
        if project_id:
            qs = qs.filter(project_id=project_id)
        return qs.filter(Q(project__owner=self.request.user) | Q(project__members=self.request.user)).distinct()


class MilestoneViewSet(ProjectScopedViewSet):
    serializer_class = MilestoneSerializer

    def get_queryset(self):
        qs = Milestone.objects.select_related("project")
        project_id = self.get_project_id()
        if project_id:
            qs = qs.filter(project_id=project_id)
        return qs.filter(Q(project__owner=self.request.user) | Q(project__members=self.request.user)).distinct()


class SubTaskViewSet(ProjectScopedViewSet):
    serializer_class = SubTaskSerializer

    def get_queryset(self):
        return SubTask.objects.filter(
            Q(task__project__owner=self.request.user) | Q(task__project__members=self.request.user)
        ).distinct()


class TaskCommentViewSet(ProjectScopedViewSet):
    serializer_class = TaskCommentSerializer

    def get_queryset(self):
        return TaskComment.objects.select_related("author", "task").filter(
            Q(task__project__owner=self.request.user) | Q(task__project__members=self.request.user)
        ).distinct()

    def perform_create(self, serializer):
        serializer.save(author=self.request.user)

    def perform_destroy(self, instance):
        if instance.author_id != self.request.user.id:
            raise PermissionDenied("Seul l'auteur peut supprimer ce commentaire.")
        instance.delete()


class TaskAttachmentViewSet(ProjectScopedViewSet):
    serializer_class = TaskAttachmentSerializer
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def get_queryset(self):
        qs = TaskAttachment.objects.filter(
            Q(task__project__owner=self.request.user) | Q(task__project__members=self.request.user)
        ).distinct()
        task_id = self.request.query_params.get("task")
        if task_id:
            qs = qs.filter(task_id=task_id)
        return qs

    def perform_create(self, serializer):
        serializer.save(uploaded_by=self.request.user, source=TaskAttachment.SOURCE_LINK)

    @decorators.action(detail=False, methods=["post"], url_path="upload")
    def upload(self, request):
        task_id = request.data.get("task")
        uploaded = request.FILES.get("file")
        if not task_id or not uploaded:
            return response.Response({"detail": "task et file sont requis."}, status=status.HTTP_400_BAD_REQUEST)
        task = get_object_or_404(
            Task.objects.filter(Q(project__owner=request.user) | Q(project__members=request.user)).distinct(),
            pk=task_id,
        )
        att = TaskAttachment(
            task=task,
            name=(request.data.get("name") or uploaded.name or "fichier").strip(),
            file_url="",
            mime_type=(getattr(uploaded, "content_type", "") or "").strip(),
            file_size=getattr(uploaded, "size", 0) or 0,
            source=TaskAttachment.SOURCE_UPLOAD,
            uploaded_by=request.user,
        )
        att.file.save(uploaded.name, uploaded, save=False)
        att.file_url = att.file.url if att.file else ""
        att.save()
        return response.Response(self.get_serializer(att).data, status=status.HTTP_201_CREATED)

    @decorators.action(detail=False, methods=["post"], url_path="import-ged")
    def import_ged(self, request):
        task_id = request.data.get("task")
        ged_id = request.data.get("gedDocumentId") or request.data.get("ged_document")
        if not task_id or not ged_id:
            return response.Response({"detail": "task et gedDocumentId sont requis."}, status=status.HTTP_400_BAD_REQUEST)
        task = get_object_or_404(
            Task.objects.filter(Q(project__owner=request.user) | Q(project__members=request.user)).distinct(),
            pk=task_id,
        )
        ged_doc = get_object_or_404(GedDocument, pk=ged_id)
        if not can_view_document(request.user, ged_doc):
            raise PermissionDenied("Document GED introuvable.")
        try:
            name, mime, size, file_content = _copy_ged_document_to_storage(
                ged_doc,
                preferred_name=(request.data.get("name") or ged_doc.original_filename or ged_doc.title or "").strip() or None,
            )
        except ValueError:
            return response.Response({"detail": "Fichier GED invalide."}, status=status.HTTP_400_BAD_REQUEST)
        att = TaskAttachment(
            task=task,
            name=name,
            file_url="",
            mime_type=mime,
            file_size=size,
            source=TaskAttachment.SOURCE_GED,
            ged_document=ged_doc,
            uploaded_by=request.user,
        )
        att.file.save(name, file_content, save=False)
        att.file_url = att.file.url if att.file else ""
        att.save()
        return response.Response(self.get_serializer(att).data, status=status.HTTP_201_CREATED)

    @decorators.action(detail=True, methods=["get"], url_path="preview-url")
    def preview_url(self, request, pk=None):
        att = self.get_object()
        if not att.file:
            # Source lien externe: renvoyer directement l'URL stockee.
            if att.source == TaskAttachment.SOURCE_LINK and (att.file_url or "").strip():
                return response.Response({"url": (att.file_url or "").strip()})
            return response.Response({"detail": "Aucun fichier a previsualiser."}, status=status.HTTP_400_BAD_REQUEST)
        schema = connection.schema_name
        t = project_file_token("task", str(att.pk), schema)
        path = f"/api/projects/file-preview/?t={quote(t, safe='')}"
        return response.Response({"url": request.build_absolute_uri(path)})

    @decorators.action(detail=True, methods=["get"], url_path="onlyoffice-config")
    def onlyoffice_config(self, request, pk=None):
        att = self.get_object()
        if not att.file:
            return response.Response({"detail": "Aucun fichier a ouvrir."}, status=status.HTTP_400_BAD_REQUEST)
        if not (settings.ONLYOFFICE_JWT_SECRET or "").strip():
            return response.Response({"detail": "ONLYOFFICE non configure."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        ext = extension_from_name_mime(att.name, att.mime_type)
        if onlyoffice_document_type_for_ext(ext) is None:
            return response.Response({"detail": "Format non pris en charge par ONLYOFFICE."}, status=status.HTTP_400_BAD_REQUEST)
        internal = (settings.OFFICE_FILE_DOWNLOAD_BASE or "").strip()
        if not internal:
            return response.Response({"detail": "OFFICE_FILE_DOWNLOAD_BASE non configure."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        schema = connection.schema_name
        can_edit = _user_can_access_project(request.user, att.task.project)
        config = build_onlyoffice_config_for_attachment(
            kind="task",
            attachment_id=str(att.pk),
            schema_name=schema,
            title=att.name,
            mime_type=att.mime_type,
            updated_ts=int(att.updated_at.timestamp()),
            user=request.user,
            internal_download_base=internal,
            can_edit=can_edit,
        )
        token = jwt_sign_onlyoffice_config(config)
        return response.Response(
            {
                "documentServerUrl": settings.ONLYOFFICE_DOCUMENT_SERVER_URL.rstrip("/"),
                "config": config,
                "token": token,
            }
        )


class ProjectAttachmentViewSet(ProjectScopedViewSet):
    serializer_class = ProjectAttachmentSerializer
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def get_queryset(self):
        qs = ProjectAttachment.objects.filter(
            Q(project__owner=self.request.user) | Q(project__members=self.request.user)
        ).distinct()
        project_id = self.request.query_params.get("project")
        if project_id:
            qs = qs.filter(project_id=project_id)
        return qs

    def perform_create(self, serializer):
        serializer.save(uploaded_by=self.request.user, source=ProjectAttachment.SOURCE_LINK)

    @decorators.action(detail=False, methods=["post"], url_path="upload")
    def upload(self, request):
        project_id = request.data.get("project")
        uploaded = request.FILES.get("file")
        if not project_id or not uploaded:
            return response.Response({"detail": "project et file sont requis."}, status=status.HTTP_400_BAD_REQUEST)
        project = get_object_or_404(
            Project.objects.filter(Q(owner=request.user) | Q(members=request.user)).distinct(),
            pk=project_id,
        )
        att = ProjectAttachment(
            project=project,
            name=(request.data.get("name") or uploaded.name or "fichier").strip(),
            file_url="",
            mime_type=(getattr(uploaded, "content_type", "") or "").strip(),
            file_size=getattr(uploaded, "size", 0) or 0,
            source=ProjectAttachment.SOURCE_UPLOAD,
            uploaded_by=request.user,
        )
        att.file.save(uploaded.name, uploaded, save=False)
        att.file_url = att.file.url if att.file else ""
        att.save()
        return response.Response(self.get_serializer(att).data, status=status.HTTP_201_CREATED)

    @decorators.action(detail=False, methods=["post"], url_path="import-ged")
    def import_ged(self, request):
        project_id = request.data.get("project")
        ged_id = request.data.get("gedDocumentId") or request.data.get("ged_document")
        if not project_id or not ged_id:
            return response.Response({"detail": "project et gedDocumentId sont requis."}, status=status.HTTP_400_BAD_REQUEST)
        project = get_object_or_404(
            Project.objects.filter(Q(owner=request.user) | Q(members=request.user)).distinct(),
            pk=project_id,
        )
        ged_doc = get_object_or_404(GedDocument, pk=ged_id)
        if not can_view_document(request.user, ged_doc):
            raise PermissionDenied("Document GED introuvable.")
        try:
            name, mime, size, file_content = _copy_ged_document_to_storage(
                ged_doc,
                preferred_name=(request.data.get("name") or ged_doc.original_filename or ged_doc.title or "").strip() or None,
            )
        except ValueError:
            return response.Response({"detail": "Fichier GED invalide."}, status=status.HTTP_400_BAD_REQUEST)
        att = ProjectAttachment(
            project=project,
            name=name,
            file_url="",
            mime_type=mime,
            file_size=size,
            source=ProjectAttachment.SOURCE_GED,
            ged_document=ged_doc,
            uploaded_by=request.user,
        )
        att.file.save(name, file_content, save=False)
        att.file_url = att.file.url if att.file else ""
        att.save()
        return response.Response(self.get_serializer(att).data, status=status.HTTP_201_CREATED)

    @decorators.action(detail=True, methods=["get"], url_path="preview-url")
    def preview_url(self, request, pk=None):
        att = self.get_object()
        if not att.file:
            # Source lien externe: renvoyer directement l'URL stockee.
            if att.source == ProjectAttachment.SOURCE_LINK and (att.file_url or "").strip():
                return response.Response({"url": (att.file_url or "").strip()})
            return response.Response({"detail": "Aucun fichier a previsualiser."}, status=status.HTTP_400_BAD_REQUEST)
        schema = connection.schema_name
        t = project_file_token("project", str(att.pk), schema)
        path = f"/api/projects/file-preview/?t={quote(t, safe='')}"
        return response.Response({"url": request.build_absolute_uri(path)})

    @decorators.action(detail=True, methods=["get"], url_path="onlyoffice-config")
    def onlyoffice_config(self, request, pk=None):
        att = self.get_object()
        if not att.file:
            return response.Response({"detail": "Aucun fichier a ouvrir."}, status=status.HTTP_400_BAD_REQUEST)
        if not (settings.ONLYOFFICE_JWT_SECRET or "").strip():
            return response.Response({"detail": "ONLYOFFICE non configure."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        ext = extension_from_name_mime(att.name, att.mime_type)
        if onlyoffice_document_type_for_ext(ext) is None:
            return response.Response({"detail": "Format non pris en charge par ONLYOFFICE."}, status=status.HTTP_400_BAD_REQUEST)
        internal = (settings.OFFICE_FILE_DOWNLOAD_BASE or "").strip()
        if not internal:
            return response.Response({"detail": "OFFICE_FILE_DOWNLOAD_BASE non configure."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        schema = connection.schema_name
        can_edit = _user_can_access_project(request.user, att.project)
        config = build_onlyoffice_config_for_attachment(
            kind="project",
            attachment_id=str(att.pk),
            schema_name=schema,
            title=att.name,
            mime_type=att.mime_type,
            updated_ts=int(att.updated_at.timestamp()),
            user=request.user,
            internal_download_base=internal,
            can_edit=can_edit,
        )
        token = jwt_sign_onlyoffice_config(config)
        return response.Response(
            {
                "documentServerUrl": settings.ONLYOFFICE_DOCUMENT_SERVER_URL.rstrip("/"),
                "config": config,
                "token": token,
            }
        )


class TimeEntryViewSet(ProjectScopedViewSet):
    serializer_class = TimeEntrySerializer

    def get_queryset(self):
        qs = TimeEntry.objects.select_related("task", "user").filter(
            Q(task__project__owner=self.request.user) | Q(task__project__members=self.request.user)
        ).distinct()
        project_id = self.get_project_id()
        task_id = self.request.query_params.get("task")
        if project_id:
            qs = qs.filter(task__project_id=project_id)
        if task_id:
            qs = qs.filter(task_id=task_id)
        return qs

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @decorators.action(detail=False, methods=["post"])
    def start(self, request):
        task_id = request.data.get("task")
        note = (request.data.get("note") or "").strip()
        if not task_id:
            return response.Response({"detail": "task est requis."}, status=status.HTTP_400_BAD_REQUEST)

        task = get_object_or_404(
            Task.objects.filter(Q(project__owner=request.user) | Q(project__members=request.user)).distinct(),
            pk=task_id,
        )
        existing = (
            TimeEntry.objects.filter(task=task, user=request.user, ended_at__isnull=True)
            .order_by("-started_at")
            .first()
        )
        if existing:
            serializer = self.get_serializer(existing)
            return response.Response(serializer.data, status=status.HTTP_200_OK)

        entry = TimeEntry.objects.create(
            task=task,
            user=request.user,
            started_at=timezone.now(),
            ended_at=None,
            seconds_spent=0,
            note=note,
        )
        serializer = self.get_serializer(entry)
        return response.Response(serializer.data, status=status.HTTP_201_CREATED)

    @decorators.action(detail=False, methods=["post"])
    def stop(self, request):
        task_id = request.data.get("task")
        note = (request.data.get("note") or "").strip()
        if not task_id:
            return response.Response({"detail": "task est requis."}, status=status.HTTP_400_BAD_REQUEST)

        task = get_object_or_404(
            Task.objects.filter(Q(project__owner=request.user) | Q(project__members=request.user)).distinct(),
            pk=task_id,
        )
        entry = (
            TimeEntry.objects.filter(task=task, user=request.user, ended_at__isnull=True)
            .order_by("-started_at")
            .first()
        )
        if not entry:
            return response.Response({"detail": "Aucun timer actif pour cette tache."}, status=status.HTTP_404_NOT_FOUND)

        now = timezone.now()
        computed_seconds = max(int((now - entry.started_at).total_seconds()), 0)
        entry.ended_at = now
        entry.seconds_spent = max(entry.seconds_spent or 0, computed_seconds)
        if note:
            entry.note = note
        entry.save(update_fields=["ended_at", "seconds_spent", "note", "updated_at"])
        serializer = self.get_serializer(entry)
        return response.Response(serializer.data, status=status.HTTP_200_OK)


class TaskDependencyViewSet(ProjectScopedViewSet):
    serializer_class = TaskDependencySerializer

    def get_queryset(self):
        return TaskDependency.objects.filter(
            Q(task__project__owner=self.request.user) | Q(task__project__members=self.request.user)
        ).distinct()


class InAppNotificationViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = InAppNotificationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return InAppNotification.objects.filter(recipient=self.request.user).order_by("-created_at")

    @decorators.action(detail=True, methods=["post"])
    def mark_read(self, request, pk=None):
        notification = self.get_object()
        if not notification.is_read:
            notification.is_read = True
            notification.save(update_fields=["is_read", "updated_at"])
        return response.Response({"status": "ok"})

    @decorators.action(detail=False, methods=["post"])
    def mark_all_read(self, request):
        self.get_queryset().filter(is_read=False).update(is_read=True)
        return response.Response({"status": "ok"})
