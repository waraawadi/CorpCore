from django.contrib import admin

from .models import Contract, Department, EmployeeProfile, LeaveRequest, Payroll, PayrollComponent, PayrollRule, Position


@admin.register(EmployeeProfile)
class EmployeeProfileAdmin(admin.ModelAdmin):
    list_display = (
        "user",
        "employee_number",
        "job_title",
        "department",
        "nationality",
        "is_company_admin",
    )
    search_fields = (
        "user__username",
        "user__email",
        "employee_number",
        "job_title",
        "department",
        "national_id_number",
    )
    list_filter = ("is_company_admin", "gender", "marital_status", "nationality", "residential_country")


@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    list_display = ("name", "code", "is_active")
    search_fields = ("name", "code")
    list_filter = ("is_active",)


@admin.register(Position)
class PositionAdmin(admin.ModelAdmin):
    list_display = ("title", "department", "code", "base_salary", "is_active")
    search_fields = ("title", "code", "department__name")
    list_filter = ("is_active", "department")


@admin.register(Contract)
class ContractAdmin(admin.ModelAdmin):
    list_display = ("employee", "contract_type", "start_date", "end_date", "salary", "status")
    search_fields = ("employee__user__username", "employee__user__email")
    list_filter = ("contract_type", "status", "currency")


@admin.register(LeaveRequest)
class LeaveRequestAdmin(admin.ModelAdmin):
    list_display = ("employee", "leave_type", "start_date", "end_date", "days", "status")
    search_fields = ("employee__user__username", "employee__user__email")
    list_filter = ("leave_type", "status")


@admin.register(Payroll)
class PayrollAdmin(admin.ModelAdmin):
    list_display = ("employee", "period_month", "period_year", "base_salary", "gross_salary", "net_salary", "status")
    search_fields = ("employee__user__username", "employee__user__email")
    list_filter = ("status", "period_year")


@admin.register(PayrollRule)
class PayrollRuleAdmin(admin.ModelAdmin):
    list_display = ("name", "category", "default_amount", "is_active")
    search_fields = ("name", "code")
    list_filter = ("category", "is_active")


@admin.register(PayrollComponent)
class PayrollComponentAdmin(admin.ModelAdmin):
    list_display = ("payroll", "rule", "amount")
    search_fields = ("payroll__employee__user__username", "rule__name")
    list_filter = ("rule__category",)
