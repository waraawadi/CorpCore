from decimal import Decimal

from django.db import transaction
from django.db.models import Count, Sum
from rest_framework import decorators, permissions, response, status, viewsets
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.views import APIView

from .models import CrmActivity, CrmContact, CrmLead, CrmOpportunity
from .serializers import (
    ConvertLeadSerializer,
    CrmActivitySerializer,
    CrmContactSerializer,
    CrmLeadSerializer,
    CrmOpportunitySerializer,
)


def _user_is_company_admin(user) -> bool:
    if user.is_staff or user.is_superuser:
        return True
    emp = getattr(user, "employee_profile", None)
    return bool(emp and getattr(emp, "is_company_admin", False))


def _can_write_crm_record(user, owner_id) -> bool:
    if user.is_staff or user.is_superuser:
        return True
    if _user_is_company_admin(user):
        return True
    return owner_id == user.id


class CrmDashboardView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        leads_qs = CrmLead.objects.all()
        opps_qs = CrmOpportunity.objects.all()
        lead_by_status = dict(leads_qs.values("status").annotate(c=Count("id")).values_list("status", "c"))
        opp_by_stage = dict(opps_qs.values("stage").annotate(c=Count("id")).values_list("stage", "c"))
        pipeline = (
            opps_qs.filter(
                stage__in=[
                    CrmOpportunity.STAGE_DISCOVERY,
                    CrmOpportunity.STAGE_PROPOSAL,
                    CrmOpportunity.STAGE_NEGOTIATION,
                ]
            ).aggregate(total=Sum("amount"))["total"]
            or Decimal("0")
        )
        weighted = Decimal("0")
        for opp in opps_qs.filter(
            stage__in=[
                CrmOpportunity.STAGE_DISCOVERY,
                CrmOpportunity.STAGE_PROPOSAL,
                CrmOpportunity.STAGE_NEGOTIATION,
            ]
        ).only("amount", "probability"):
            weighted += (opp.amount or Decimal("0")) * Decimal(opp.probability or 0) / Decimal("100")
        return response.Response(
            {
                "contacts_count": CrmContact.objects.count(),
                "leads_count": leads_qs.count(),
                "leads_by_status": lead_by_status,
                "opportunities_count": opps_qs.count(),
                "opportunities_by_stage": opp_by_stage,
                "pipeline_amount": str(pipeline),
                "weighted_pipeline_amount": str(weighted.quantize(Decimal("0.01"))),
            }
        )


class CrmContactViewSet(viewsets.ModelViewSet):
    serializer_class = CrmContactSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return CrmContact.objects.select_related("owner").all()

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

    def perform_update(self, serializer):
        if not _can_write_crm_record(self.request.user, serializer.instance.owner_id):
            raise PermissionDenied()
        serializer.save()

    def perform_destroy(self, instance):
        if not _can_write_crm_record(self.request.user, instance.owner_id):
            raise PermissionDenied()
        instance.delete()


class CrmLeadViewSet(viewsets.ModelViewSet):
    serializer_class = CrmLeadSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return CrmLead.objects.select_related("owner", "contact").all()

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

    def perform_update(self, serializer):
        if not _can_write_crm_record(self.request.user, serializer.instance.owner_id):
            raise PermissionDenied()
        serializer.save()

    def perform_destroy(self, instance):
        if not _can_write_crm_record(self.request.user, instance.owner_id):
            raise PermissionDenied()
        instance.delete()

    @decorators.action(detail=True, methods=["post"], url_path="convert")
    @transaction.atomic
    def convert(self, request, pk=None):
        lead = self.get_object()
        if not _can_write_crm_record(request.user, lead.owner_id):
            raise PermissionDenied()
        if lead.status == CrmLead.STATUS_CONVERTED:
            raise ValidationError({"detail": "Cette piste est deja convertie."})
        ser = ConvertLeadSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data
        opp = CrmOpportunity.objects.create(
            name=data["opportunity_name"],
            stage=data["stage"],
            amount=data["amount"],
            lead=lead,
            contact=lead.contact,
            owner=lead.owner,
            expected_close_date=data.get("expected_close_date"),
        )
        lead.status = CrmLead.STATUS_CONVERTED
        lead.save(update_fields=["status", "updated_at"])
        return response.Response(CrmOpportunitySerializer(opp).data, status=status.HTTP_201_CREATED)


class CrmOpportunityViewSet(viewsets.ModelViewSet):
    serializer_class = CrmOpportunitySerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return CrmOpportunity.objects.select_related("owner", "lead", "contact").all()

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

    def perform_update(self, serializer):
        if not _can_write_crm_record(self.request.user, serializer.instance.owner_id):
            raise PermissionDenied()
        serializer.save()

    def perform_destroy(self, instance):
        if not _can_write_crm_record(self.request.user, instance.owner_id):
            raise PermissionDenied()
        instance.delete()


class CrmActivityViewSet(viewsets.ModelViewSet):
    serializer_class = CrmActivitySerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return CrmActivity.objects.select_related("created_by", "contact", "lead", "opportunity").all()

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def perform_update(self, serializer):
        if not _can_write_crm_record(self.request.user, serializer.instance.created_by_id):
            raise PermissionDenied()
        serializer.save()

    def perform_destroy(self, instance):
        if not _can_write_crm_record(self.request.user, instance.created_by_id):
            raise PermissionDenied()
        instance.delete()
