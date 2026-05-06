from django.db.models import Q
from django.utils import timezone
from rest_framework import permissions, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from django.contrib.auth import get_user_model

from .leave_balance import (
    annual_days_pending_in_year,
    annual_days_used_in_year,
    annual_entitlement_for_employee,
    annual_remaining_by_year,
)
from .models import Contract, Department, EmployeeProfile, LeaveRequest, Payroll, PayrollRule, Position
from .notifications import notify_leave_decision, notify_leave_request_submitted
from .serializers import (
    ContractSerializer,
    DepartmentSerializer,
    EmployeeProfileSerializer,
    LeaveRequestSerializer,
    PayrollSerializer,
    PayrollRuleSerializer,
    PositionSerializer,
    UserOptionSerializer,
)

User = get_user_model()


class BaseHRViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]


class DepartmentViewSet(BaseHRViewSet):
    serializer_class = DepartmentSerializer
    queryset = Department.objects.all().order_by("name")


class UserOptionViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = UserOptionSerializer
    queryset = User.objects.all().order_by("first_name", "last_name", "username")


class PositionViewSet(BaseHRViewSet):
    serializer_class = PositionSerializer
    queryset = Position.objects.select_related("department").all().order_by("title")

    def get_queryset(self):
        queryset = super().get_queryset()
        department_id = self.request.query_params.get("department")
        if department_id:
            queryset = queryset.filter(department_id=department_id)
        return queryset


class EmployeeProfileViewSet(BaseHRViewSet):
    serializer_class = EmployeeProfileSerializer
    queryset = (
        EmployeeProfile.objects.select_related("user", "department_ref", "position_ref", "manager")
        .all()
        .order_by("-created_at")
    )

    def get_queryset(self):
        queryset = super().get_queryset()
        department_id = self.request.query_params.get("department")
        position_id = self.request.query_params.get("position")
        if department_id:
            queryset = queryset.filter(department_ref_id=department_id)
        if position_id:
            queryset = queryset.filter(position_ref_id=position_id)
        return queryset


class ContractViewSet(BaseHRViewSet):
    serializer_class = ContractSerializer
    queryset = Contract.objects.select_related("employee__user", "position").all().order_by("-start_date")

    def get_queryset(self):
        queryset = super().get_queryset()
        employee_id = self.request.query_params.get("employee")
        status_value = self.request.query_params.get("status")
        if employee_id:
            queryset = queryset.filter(employee_id=employee_id)
        if status_value:
            queryset = queryset.filter(status=status_value)
        return queryset


def _leave_approver(user, leave) -> bool:
    if user.is_staff or user.is_superuser:
        return True
    emp = getattr(user, "employee_profile", None)
    if emp and getattr(emp, "is_company_admin", False):
        return True
    if getattr(leave.employee, "manager_id", None) == user.id:
        return True
    return False


def _leave_can_cancel(user, leave) -> bool:
    if user.is_staff or user.is_superuser:
        return True
    emp = getattr(user, "employee_profile", None)
    if emp and getattr(emp, "is_company_admin", False):
        return True
    return leave.employee.user_id == user.id


class LeaveRequestViewSet(BaseHRViewSet):
    serializer_class = LeaveRequestSerializer
    queryset = (
        LeaveRequest.objects.select_related("employee__user", "employee__manager", "approved_by")
        .all()
        .order_by("-start_date", "-created_at")
    )

    def get_queryset(self):
        user = self.request.user
        if user.is_staff or user.is_superuser:
            qs = super().get_queryset()
        else:
            emp = getattr(user, "employee_profile", None)
            if emp and emp.is_company_admin:
                qs = super().get_queryset()
            elif emp:
                managed_ids = list(EmployeeProfile.objects.filter(manager_id=user.id).values_list("id", flat=True))
                q = Q(employee_id=emp.id)
                if managed_ids:
                    q |= Q(employee_id__in=managed_ids)
                qs = super().get_queryset().filter(q)
            else:
                managed_ids = (
                    EmployeeProfile.objects.filter(manager_id=user.id).values_list("id", flat=True)
                )
                qs = (
                    super().get_queryset().filter(employee_id__in=managed_ids)
                    if managed_ids
                    else super().get_queryset().none()
                )
        employee_id = self.request.query_params.get("employee")
        status_value = self.request.query_params.get("status")
        if employee_id:
            qs = qs.filter(employee_id=employee_id)
        if status_value:
            qs = qs.filter(status=status_value)
        return qs

    def perform_create(self, serializer):
        user = self.request.user
        emp_target = serializer.validated_data.get("employee")
        if user.is_staff or user.is_superuser:
            leave = serializer.save()
            notify_leave_request_submitted(tenant=getattr(self.request, "tenant", None), leave=leave)
            return
        caller = getattr(user, "employee_profile", None)
        if not caller or emp_target.id != caller.id:
            raise PermissionDenied("Vous ne pouvez creer une demande que pour votre propre profil employe.")
        leave = serializer.save()
        notify_leave_request_submitted(tenant=getattr(self.request, "tenant", None), leave=leave)

    def perform_update(self, serializer):
        if serializer.instance.status != LeaveRequest.STATUS_PENDING:
            raise ValidationError({"detail": "Seules les demandes en attente peuvent etre modifiees."})
        user = self.request.user
        if not user.is_staff and not user.is_superuser:
            caller = getattr(user, "employee_profile", None)
            if not caller or serializer.instance.employee_id != caller.id:
                raise PermissionDenied("Modification non autorisee.")
        serializer.save()

    def perform_destroy(self, instance):
        if instance.status != LeaveRequest.STATUS_PENDING:
            raise ValidationError({"detail": "Seules les demandes en attente peuvent etre supprimees."})
        user = self.request.user
        if not user.is_staff and not user.is_superuser:
            caller = getattr(user, "employee_profile", None)
            if not caller or instance.employee_id != caller.id:
                raise PermissionDenied("Suppression non autorisee.")
        instance.delete()

    @action(detail=False, methods=["get"], url_path="summary")
    def summary(self, request):
        year = int(request.query_params.get("year", timezone.now().year))
        user = request.user
        if user.is_staff or user.is_superuser:
            emps = EmployeeProfile.objects.select_related("user").all()
        else:
            emp = getattr(user, "employee_profile", None)
            if emp and emp.is_company_admin:
                emps = EmployeeProfile.objects.select_related("user").all()
            elif emp:
                ids = [emp.id] + list(
                    EmployeeProfile.objects.filter(manager_id=user.id).values_list("id", flat=True)
                )
                emps = EmployeeProfile.objects.filter(id__in=ids).select_related("user")
            else:
                managed = EmployeeProfile.objects.filter(manager_id=user.id).values_list("id", flat=True)
                emps = (
                    EmployeeProfile.objects.filter(id__in=managed).select_related("user")
                    if managed
                    else EmployeeProfile.objects.none()
                )
        balances = []
        for e in emps:
            ent = annual_entitlement_for_employee(e)
            used = annual_days_used_in_year(employee_id=e.id, year=year)
            pending = annual_days_pending_in_year(employee_id=e.id, year=year)
            rem = annual_remaining_by_year(employee=e, year=year, exclude_leave_id=None)
            balances.append(
                {
                    "employee_id": str(e.id),
                    "employee_name": e.user.get_full_name() or e.user.username,
                    "year": year,
                    "entitlement": str(ent),
                    "used": str(used),
                    "pending": str(pending),
                    "remaining": str(rem),
                }
            )
        return Response({"year": year, "balances": balances})

    @action(detail=True, methods=["post"], url_path="approve")
    def approve(self, request, pk=None):
        leave = self.get_object()
        if leave.status != LeaveRequest.STATUS_PENDING:
            raise ValidationError({"detail": "Seules les demandes en attente peuvent etre approuvees."})
        if not _leave_approver(request.user, leave):
            raise PermissionDenied("Seuls le manager hierarchique, RH ou administrateur peuvent approuver.")
        leave.status = LeaveRequest.STATUS_APPROVED
        leave.approved_by = request.user
        leave.approved_at = timezone.now()
        leave.save(update_fields=["status", "approved_by", "approved_at", "updated_at"])
        notify_leave_decision(tenant=getattr(request, "tenant", None), leave=leave, decision="approved")
        return Response(self.get_serializer(leave).data)

    @action(detail=True, methods=["post"], url_path="reject")
    def reject(self, request, pk=None):
        leave = self.get_object()
        if leave.status != LeaveRequest.STATUS_PENDING:
            raise ValidationError({"detail": "Seules les demandes en attente peuvent etre refusees."})
        if not _leave_approver(request.user, leave):
            raise PermissionDenied("Seuls le manager hierarchique, RH ou administrateur peuvent refuser.")
        leave.status = LeaveRequest.STATUS_REJECTED
        leave.approved_by = request.user
        leave.approved_at = timezone.now()
        leave.save(update_fields=["status", "approved_by", "approved_at", "updated_at"])
        notify_leave_decision(tenant=getattr(request, "tenant", None), leave=leave, decision="rejected")
        return Response(self.get_serializer(leave).data)

    @action(detail=True, methods=["post"], url_path="cancel")
    def cancel(self, request, pk=None):
        leave = self.get_object()
        if leave.status != LeaveRequest.STATUS_PENDING:
            raise ValidationError({"detail": "Seules les demandes en attente peuvent etre annulees."})
        if not _leave_can_cancel(request.user, leave):
            raise PermissionDenied("Annulation non autorisee.")
        leave.status = LeaveRequest.STATUS_CANCELLED
        leave.save(update_fields=["status", "updated_at"])
        return Response(self.get_serializer(leave).data)


class PayrollViewSet(BaseHRViewSet):
    serializer_class = PayrollSerializer
    queryset = Payroll.objects.select_related("employee__user").all().order_by("-period_year", "-period_month")

    def get_queryset(self):
        queryset = super().get_queryset()
        employee_id = self.request.query_params.get("employee")
        period_year = self.request.query_params.get("period_year")
        if employee_id:
            queryset = queryset.filter(employee_id=employee_id)
        if period_year:
            queryset = queryset.filter(period_year=period_year)
        return queryset


class PayrollRuleViewSet(BaseHRViewSet):
    serializer_class = PayrollRuleSerializer
    queryset = PayrollRule.objects.all().order_by("category", "name")

    def get_queryset(self):
        queryset = super().get_queryset()
        category = self.request.query_params.get("category")
        if category:
            queryset = queryset.filter(category=category)
        return queryset

