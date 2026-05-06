import uuid
from decimal import Decimal

from django.conf import settings
from django.db import models


class Department(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=150)
    code = models.CharField(max_length=30, blank=True, default="")
    description = models.TextField(blank=True, default="")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("name",)
        constraints = [
            models.UniqueConstraint(fields=("name",), name="uniq_department_name"),
        ]

    def __str__(self) -> str:
        return self.name


class Position(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=150)
    code = models.CharField(max_length=30, blank=True, default="")
    department = models.ForeignKey(Department, on_delete=models.PROTECT, related_name="positions")
    description = models.TextField(blank=True, default="")
    base_salary = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("title",)
        constraints = [
            models.UniqueConstraint(fields=("department", "title"), name="uniq_position_title_per_department"),
        ]

    def __str__(self) -> str:
        return f"{self.title} ({self.department.name})"


class EmployeeProfile(models.Model):
    GENDER_CHOICES = (
        ("male", "Male"),
        ("female", "Female"),
        ("other", "Other"),
    )
    MARITAL_STATUS_CHOICES = (
        ("single", "Single"),
        ("married", "Married"),
        ("divorced", "Divorced"),
        ("widowed", "Widowed"),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="employee_profile")
    employee_number = models.CharField(max_length=60, blank=True, default="")
    nationality = models.CharField(max_length=120)
    date_of_birth = models.DateField()
    place_of_birth = models.CharField(max_length=120)
    gender = models.CharField(max_length=20, choices=GENDER_CHOICES)
    marital_status = models.CharField(max_length=20, choices=MARITAL_STATUS_CHOICES)
    national_id_number = models.CharField(max_length=120)
    id_document_type = models.CharField(max_length=120, blank=True, default="")
    profile_photo = models.ImageField(upload_to="employees/profile_photos/", blank=True, null=True)
    job_title = models.CharField(max_length=120)
    department = models.CharField(max_length=120)
    department_ref = models.ForeignKey(
        Department,
        on_delete=models.SET_NULL,
        related_name="employees",
        blank=True,
        null=True,
    )
    position_ref = models.ForeignKey(
        Position,
        on_delete=models.SET_NULL,
        related_name="employees",
        blank=True,
        null=True,
    )
    hire_date = models.DateField()
    professional_email = models.EmailField()
    phone_number = models.CharField(max_length=40)
    residential_country = models.CharField(max_length=120)
    residential_city = models.CharField(max_length=120)
    residential_address = models.CharField(max_length=255)
    is_company_admin = models.BooleanField(default=False)
    manager = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name="managed_employee_profiles",
        help_text="Responsable hierarchique (valide les demandes de conge).",
    )
    annual_leave_entitlement_days = models.DecimalField(
        max_digits=6,
        decimal_places=2,
        default=Decimal("25.00"),
        help_text="Droit annuel de conges payes (jours calendaires).",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-created_at",)

    def __str__(self) -> str:
        return f"{self.user} - {self.job_title}"


class Contract(models.Model):
    TYPE_PERMANENT = "permanent"
    TYPE_CDD = "fixed_term"
    TYPE_INTERNSHIP = "internship"
    TYPE_CONSULTANT = "consultant"

    STATUS_DRAFT = "draft"
    STATUS_ACTIVE = "active"
    STATUS_SUSPENDED = "suspended"
    STATUS_ENDED = "ended"

    TYPE_CHOICES = (
        (TYPE_PERMANENT, "Permanent"),
        (TYPE_CDD, "Fixed term"),
        (TYPE_INTERNSHIP, "Internship"),
        (TYPE_CONSULTANT, "Consultant"),
    )
    STATUS_CHOICES = (
        (STATUS_DRAFT, "Draft"),
        (STATUS_ACTIVE, "Active"),
        (STATUS_SUSPENDED, "Suspended"),
        (STATUS_ENDED, "Ended"),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employee = models.ForeignKey(EmployeeProfile, on_delete=models.CASCADE, related_name="contracts")
    position = models.ForeignKey(Position, on_delete=models.SET_NULL, blank=True, null=True, related_name="contracts")
    contract_type = models.CharField(max_length=20, choices=TYPE_CHOICES, default=TYPE_PERMANENT)
    start_date = models.DateField()
    end_date = models.DateField(blank=True, null=True)
    salary = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    currency = models.CharField(max_length=10, default="XOF")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_DRAFT)
    notes = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-start_date", "-created_at")

    def __str__(self) -> str:
        return f"{self.employee} - {self.contract_type}"


class LeaveRequest(models.Model):
    TYPE_ANNUAL = "annual"
    TYPE_SICK = "sick"
    TYPE_UNPAID = "unpaid"
    TYPE_MATERNITY = "maternity"
    TYPE_OTHER = "other"

    STATUS_PENDING = "pending"
    STATUS_APPROVED = "approved"
    STATUS_REJECTED = "rejected"
    STATUS_CANCELLED = "cancelled"

    TYPE_CHOICES = (
        (TYPE_ANNUAL, "Annual"),
        (TYPE_SICK, "Sick"),
        (TYPE_UNPAID, "Unpaid"),
        (TYPE_MATERNITY, "Maternity"),
        (TYPE_OTHER, "Other"),
    )
    STATUS_CHOICES = (
        (STATUS_PENDING, "Pending"),
        (STATUS_APPROVED, "Approved"),
        (STATUS_REJECTED, "Rejected"),
        (STATUS_CANCELLED, "Cancelled"),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employee = models.ForeignKey(EmployeeProfile, on_delete=models.CASCADE, related_name="leave_requests")
    leave_type = models.CharField(max_length=20, choices=TYPE_CHOICES, default=TYPE_ANNUAL)
    start_date = models.DateField()
    end_date = models.DateField()
    days = models.DecimalField(max_digits=5, decimal_places=2, default=1)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING)
    reason = models.TextField(blank=True, default="")
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name="approved_leave_requests",
    )
    approved_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-start_date", "-created_at")

    def __str__(self) -> str:
        return f"{self.employee} - {self.leave_type}"


class Payroll(models.Model):
    STATUS_DRAFT = "draft"
    STATUS_PROCESSED = "processed"
    STATUS_PAID = "paid"

    STATUS_CHOICES = (
        (STATUS_DRAFT, "Draft"),
        (STATUS_PROCESSED, "Processed"),
        (STATUS_PAID, "Paid"),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employee = models.ForeignKey(EmployeeProfile, on_delete=models.CASCADE, related_name="payrolls")
    period_month = models.PositiveSmallIntegerField()
    period_year = models.PositiveSmallIntegerField()
    base_salary = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    gross_salary = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    allowances = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    deductions = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    net_salary = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_DRAFT)
    paid_at = models.DateTimeField(blank=True, null=True)
    note = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-period_year", "-period_month", "-created_at")
        constraints = [
            models.UniqueConstraint(
                fields=("employee", "period_month", "period_year"),
                name="uniq_payroll_employee_period",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.employee} - {self.period_month:02d}/{self.period_year}"


class PayrollRule(models.Model):
    CATEGORY_BONUS = "bonus"
    CATEGORY_BENEFIT = "benefit"
    CATEGORY_DEDUCTION = "deduction"

    CATEGORY_CHOICES = (
        (CATEGORY_BONUS, "Prime"),
        (CATEGORY_BENEFIT, "Avantage en nature"),
        (CATEGORY_DEDUCTION, "Retenue"),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=150)
    code = models.CharField(max_length=40, blank=True, default="")
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES)
    default_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    description = models.TextField(blank=True, default="")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("category", "name")
        constraints = [
            models.UniqueConstraint(fields=("category", "name"), name="uniq_payroll_rule_category_name"),
        ]

    def __str__(self) -> str:
        return f"{self.get_category_display()} - {self.name}"


class PayrollComponent(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    payroll = models.ForeignKey(Payroll, on_delete=models.CASCADE, related_name="components")
    rule = models.ForeignKey(PayrollRule, on_delete=models.PROTECT, related_name="payroll_components")
    amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("rule__category", "rule__name")
        constraints = [
            models.UniqueConstraint(fields=("payroll", "rule"), name="uniq_payroll_component_rule"),
        ]

    def __str__(self) -> str:
        return f"{self.payroll} - {self.rule.name}"
