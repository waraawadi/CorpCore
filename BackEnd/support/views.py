from django.db.models import Count, Q
from rest_framework import permissions, response, viewsets
from rest_framework.exceptions import PermissionDenied
from rest_framework.views import APIView

from .models import SupportTicket, SupportTicketComment
from .serializers import (
    SupportTicketCommentSerializer,
    SupportTicketCommentWriteSerializer,
    SupportTicketDetailSerializer,
    SupportTicketListSerializer,
    SupportTicketWriteSerializer,
)


def _user_is_company_admin(user) -> bool:
    if user.is_staff or user.is_superuser:
        return True
    try:
        emp = user.employee_profile
    except Exception:
        return False
    return bool(getattr(emp, "is_company_admin", False))


def _can_edit_ticket(user, ticket: SupportTicket) -> bool:
    if user.is_staff or user.is_superuser:
        return True
    if _user_is_company_admin(user):
        return True
    if ticket.requester_id == user.id:
        return True
    if ticket.assignee_id == user.id:
        return True
    return False


def _can_delete_ticket(user) -> bool:
    return user.is_staff or user.is_superuser or _user_is_company_admin(user)


class SupportDashboardView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        qs = SupportTicket.objects.all()
        by_status = dict(qs.values("status").annotate(c=Count("id")).values_list("status", "c"))
        open_like = (
            SupportTicket.objects.filter(
                status__in=[
                    SupportTicket.STATUS_OPEN,
                    SupportTicket.STATUS_IN_PROGRESS,
                    SupportTicket.STATUS_WAITING_CUSTOMER,
                ]
            ).count()
        )
        mine = qs.filter(Q(requester=request.user) | Q(assignee=request.user)).count()
        return response.Response(
            {
                "tickets_total": qs.count(),
                "tickets_open_like": open_like,
                "tickets_mine": mine,
                "by_status": by_status,
            }
        )


class SupportTicketViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    http_method_names = ["get", "post", "put", "patch", "delete", "head", "options"]

    def get_serializer_class(self):
        if self.action == "retrieve":
            return SupportTicketDetailSerializer
        if self.action in ("create", "update", "partial_update"):
            return SupportTicketWriteSerializer
        return SupportTicketListSerializer

    def get_queryset(self):
        qs = SupportTicket.objects.select_related("requester", "assignee").annotate(
            comments_count=Count("comments", distinct=True)
        )
        if self.action == "retrieve":
            qs = qs.prefetch_related("comments", "comments__author")
        qs = qs.all()
        status_value = (self.request.query_params.get("status") or "").strip()
        priority_value = (self.request.query_params.get("priority") or "").strip()
        assignee = (self.request.query_params.get("assignee") or "").strip()
        mine = (self.request.query_params.get("mine") or "").strip().lower() in {"1", "true", "yes"}
        search = (self.request.query_params.get("search") or "").strip()
        if status_value:
            qs = qs.filter(status=status_value)
        if priority_value:
            qs = qs.filter(priority=priority_value)
        if assignee:
            qs = qs.filter(assignee_id=assignee)
        if mine:
            qs = qs.filter(Q(requester=self.request.user) | Q(assignee=self.request.user))
        if search:
            qs = qs.filter(
                Q(title__icontains=search)
                | Q(description__icontains=search)
                | Q(reference__icontains=search)
            )
        return qs.order_by("-created_at")

    def perform_create(self, serializer):
        serializer.save(requester=self.request.user)

    def perform_update(self, serializer):
        if not _can_edit_ticket(self.request.user, serializer.instance):
            raise PermissionDenied("Modification non autorisee pour ce ticket.")
        serializer.save()

    def perform_destroy(self, instance):
        if not _can_delete_ticket(self.request.user):
            raise PermissionDenied("Seuls les administrateurs peuvent supprimer un ticket.")
        instance.delete()

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        instance = (
            SupportTicket.objects.select_related("requester", "assignee")
            .prefetch_related("comments", "comments__author")
            .annotate(comments_count=Count("comments", distinct=True))
            .get(pk=serializer.instance.pk)
        )
        return response.Response(SupportTicketDetailSerializer(instance).data, status=201)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        refreshed = self.get_queryset().get(pk=serializer.instance.pk)
        return response.Response(SupportTicketDetailSerializer(refreshed).data)


class SupportTicketCommentViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    http_method_names = ["get", "post", "delete", "head", "options"]

    def get_serializer_class(self):
        if self.action == "create":
            return SupportTicketCommentWriteSerializer
        return SupportTicketCommentSerializer

    def get_queryset(self):
        qs = SupportTicketComment.objects.select_related("author", "ticket").all()
        ticket_id = (self.request.query_params.get("ticket") or "").strip()
        if ticket_id:
            qs = qs.filter(ticket_id=ticket_id)
        return qs.order_by("created_at")

    def perform_create(self, serializer):
        serializer.save(author=self.request.user)

    def perform_destroy(self, instance):
        if instance.author_id == self.request.user.id or _can_delete_ticket(self.request.user):
            instance.delete()
            return
        raise PermissionDenied("Vous ne pouvez supprimer que vos propres messages (ou etre administrateur).")
