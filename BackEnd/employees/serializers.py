import secrets
from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from rest_framework import serializers

from .leave_balance import validate_annual_leave_balance
from .models import (
    Contract,
    Department,
    EmployeeProfile,
    LeaveRequest,
    Payroll,
    PayrollComponent,
    PayrollRule,
    Position,
)
from .notifications import send_employee_credentials, send_employee_credentials_whatsapp

User = get_user_model()


class NullablePrimaryKeyRelatedField(serializers.PrimaryKeyRelatedField):
    """Accepte chaine vide (multipart) comme null pour FK optionnelles."""

    def to_internal_value(self, data):
        if data is None or data == "":
            return None
        return super().to_internal_value(data)


class UserOptionSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ("id", "username", "email", "first_name", "last_name", "full_name")

    def get_full_name(self, obj):
        return obj.get_full_name() or obj.username


class DepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = ("id", "name", "code", "description", "is_active", "created_at", "updated_at")
        read_only_fields = ("created_at", "updated_at")


class PositionSerializer(serializers.ModelSerializer):
    department_name = serializers.CharField(source="department.name", read_only=True)

    class Meta:
        model = Position
        fields = (
            "id",
            "title",
            "code",
            "department",
            "department_name",
            "description",
            "base_salary",
            "is_active",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("created_at", "updated_at")


class EmployeeProfileSerializer(serializers.ModelSerializer):
    user = serializers.PrimaryKeyRelatedField(read_only=True)
    user_email = serializers.EmailField(source="user.email", read_only=True)
    user_name = serializers.CharField(source="user.username", read_only=True)
    user_full_name = serializers.SerializerMethodField()
    user_first_name = serializers.CharField(source="user.first_name", read_only=True)
    user_last_name = serializers.CharField(source="user.last_name", read_only=True)
    first_name = serializers.CharField(write_only=True, required=False, allow_blank=False)
    last_name = serializers.CharField(write_only=True, required=False, allow_blank=False)
    personal_email = serializers.EmailField(write_only=True, required=False)
    send_whatsapp = serializers.BooleanField(write_only=True, required=False, default=True)
    remove_profile_photo = serializers.BooleanField(write_only=True, required=False, default=False)
    department_name = serializers.CharField(source="department_ref.name", read_only=True)
    position_name = serializers.CharField(source="position_ref.title", read_only=True)
    manager = NullablePrimaryKeyRelatedField(
        queryset=User.objects.all(), required=False, allow_null=True
    )
    manager_name = serializers.SerializerMethodField()

    class Meta:
        model = EmployeeProfile
        fields = (
            "id",
            "user",
            "user_email",
            "user_name",
            "user_full_name",
            "user_first_name",
            "user_last_name",
            "first_name",
            "last_name",
            "personal_email",
            "send_whatsapp",
            "employee_number",
            "nationality",
            "date_of_birth",
            "place_of_birth",
            "gender",
            "marital_status",
            "national_id_number",
            "id_document_type",
            "profile_photo",
            "remove_profile_photo",
            "job_title",
            "department",
            "department_ref",
            "department_name",
            "position_ref",
            "position_name",
            "hire_date",
            "professional_email",
            "phone_number",
            "residential_country",
            "residential_city",
            "residential_address",
            "is_company_admin",
            "manager",
            "manager_name",
            "annual_leave_entitlement_days",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("created_at", "updated_at", "user", "manager_name")

    def get_user_full_name(self, obj):
        return obj.user.get_full_name() or obj.user.username

    def get_manager_name(self, obj):
        if not obj.manager_id:
            return ""
        return obj.manager.get_full_name() or obj.manager.username

    def validate(self, attrs):
        department_ref = attrs.get("department_ref", getattr(self.instance, "department_ref", None))
        position_ref = attrs.get("position_ref", getattr(self.instance, "position_ref", None))
        if position_ref and department_ref and position_ref.department_id != department_ref.id:
            raise serializers.ValidationError(
                {"position_ref": "Le poste doit appartenir au departement selectionne."}
            )
        if self.instance is None:
            required_account_fields = ("first_name", "last_name", "personal_email")
            missing = [field for field in required_account_fields if not attrs.get(field)]
            if missing:
                raise serializers.ValidationError({field: "Ce champ est obligatoire." for field in missing})
        return attrs

    def create(self, validated_data):
        first_name = validated_data.pop("first_name")
        last_name = validated_data.pop("last_name")
        email = validated_data.pop("personal_email").strip().lower()
        send_whatsapp = validated_data.pop("send_whatsapp", True)
        validated_data.pop("remove_profile_photo", None)

        if User.objects.filter(email__iexact=email).exists():
            raise serializers.ValidationError({"personal_email": "Un utilisateur existe deja avec cet email."})

        username_base = email.split("@")[0]
        username = username_base
        suffix = 1
        while User.objects.filter(username__iexact=username).exists():
            suffix += 1
            username = f"{username_base}{suffix}"

        temp_password = secrets.token_urlsafe(8)
        user = User.objects.create_user(
            username=username,
            email=email,
            first_name=first_name.strip(),
            last_name=last_name.strip(),
            password=temp_password,
        )

        employee = EmployeeProfile.objects.create(user=user, **validated_data)
        tenant = getattr(self.context.get("request"), "tenant", None)
        full_name = user.get_full_name() or user.username
        send_employee_credentials(tenant=tenant, email=email, full_name=full_name, temp_password=temp_password)
        if send_whatsapp:
            send_employee_credentials_whatsapp(
                phone=employee.phone_number,
                full_name=full_name,
                email=email,
                temp_password=temp_password,
            )
        return employee

    def update(self, instance, validated_data):
        first_name = validated_data.pop("first_name", None)
        last_name = validated_data.pop("last_name", None)
        email = validated_data.pop("personal_email", None)
        validated_data.pop("send_whatsapp", None)
        remove_profile_photo = validated_data.pop("remove_profile_photo", False)

        if first_name is not None:
            instance.user.first_name = first_name.strip()
        if last_name is not None:
            instance.user.last_name = last_name.strip()
        if email is not None:
            normalized = email.strip().lower()
            if User.objects.exclude(pk=instance.user_id).filter(email__iexact=normalized).exists():
                raise serializers.ValidationError({"personal_email": "Un utilisateur existe deja avec cet email."})
            instance.user.email = normalized
            if instance.user.username == instance.user.email or "@" in instance.user.username:
                instance.user.username = normalized
        if remove_profile_photo and "profile_photo" not in validated_data:
            instance.profile_photo.delete(save=False)
            validated_data["profile_photo"] = None
        instance.user.save(update_fields=["first_name", "last_name", "email", "username"])
        return super().update(instance, validated_data)


class ContractSerializer(serializers.ModelSerializer):
    employee_name = serializers.SerializerMethodField()
    position_name = serializers.CharField(source="position.title", read_only=True)

    class Meta:
        model = Contract
        fields = (
            "id",
            "employee",
            "employee_name",
            "position",
            "position_name",
            "contract_type",
            "start_date",
            "end_date",
            "salary",
            "currency",
            "status",
            "notes",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("created_at", "updated_at")

    def get_employee_name(self, obj):
        full_name = obj.employee.user.get_full_name()
        return full_name or obj.employee.user.username

    def validate(self, attrs):
        start_date = attrs.get("start_date", getattr(self.instance, "start_date", None))
        end_date = attrs.get("end_date", getattr(self.instance, "end_date", None))
        if start_date and end_date and end_date < start_date:
            raise serializers.ValidationError({"end_date": "La date de fin doit etre >= date de debut."})
        return attrs


def _leave_calendar_days(start: date, end: date) -> Decimal:
    if not start or not end or end < start:
        return Decimal("0")
    return Decimal(str((end - start).days + 1))


class LeaveRequestSerializer(serializers.ModelSerializer):
    employee_name = serializers.SerializerMethodField()
    approved_by_name = serializers.CharField(source="approved_by.username", read_only=True)
    employee_manager_id = serializers.SerializerMethodField()

    class Meta:
        model = LeaveRequest
        fields = (
            "id",
            "employee",
            "employee_name",
            "employee_manager_id",
            "leave_type",
            "start_date",
            "end_date",
            "days",
            "status",
            "reason",
            "approved_by",
            "approved_by_name",
            "approved_at",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "created_at",
            "updated_at",
            "days",
            "status",
            "approved_by",
            "approved_at",
            "employee_name",
            "employee_manager_id",
            "approved_by_name",
        )

    def get_employee_name(self, obj):
        full_name = obj.employee.user.get_full_name()
        return full_name or obj.employee.user.username

    def get_employee_manager_id(self, obj):
        return obj.employee.manager_id

    def validate(self, attrs):
        start_date = attrs.get("start_date", getattr(self.instance, "start_date", None))
        end_date = attrs.get("end_date", getattr(self.instance, "end_date", None))
        if start_date and end_date and end_date < start_date:
            raise serializers.ValidationError({"end_date": "La date de fin doit etre >= date de debut."})
        leave_type = attrs.get("leave_type", getattr(self.instance, "leave_type", None))
        employee = attrs.get("employee", getattr(self.instance, "employee", None))
        if (
            leave_type == LeaveRequest.TYPE_ANNUAL
            and employee
            and start_date
            and end_date
        ):
            validate_annual_leave_balance(
                employee=employee,
                start_date=start_date,
                end_date=end_date,
                exclude_leave_id=self.instance.pk if self.instance else None,
            )
        return attrs

    def create(self, validated_data):
        validated_data["days"] = _leave_calendar_days(validated_data["start_date"], validated_data["end_date"])
        return super().create(validated_data)

    def update(self, instance, validated_data):
        start = validated_data.get("start_date", instance.start_date)
        end = validated_data.get("end_date", instance.end_date)
        validated_data["days"] = _leave_calendar_days(start, end)
        return super().update(instance, validated_data)


class PayrollSerializer(serializers.ModelSerializer):
    employee_name = serializers.SerializerMethodField()
    components = serializers.SerializerMethodField()
    bonus_rule_ids = serializers.ListField(
        child=serializers.UUIDField(), write_only=True, required=False, allow_empty=True
    )
    benefit_rule_ids = serializers.ListField(
        child=serializers.UUIDField(), write_only=True, required=False, allow_empty=True
    )
    deduction_rule_ids = serializers.ListField(
        child=serializers.UUIDField(), write_only=True, required=False, allow_empty=True
    )
    bonus_amount_overrides = serializers.DictField(
        child=serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal("0")),
        write_only=True,
        required=False,
    )
    benefit_amount_overrides = serializers.DictField(
        child=serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal("0")),
        write_only=True,
        required=False,
    )
    deduction_amount_overrides = serializers.DictField(
        child=serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal("0")),
        write_only=True,
        required=False,
    )
    selected_bonus_rule_ids = serializers.SerializerMethodField()
    selected_benefit_rule_ids = serializers.SerializerMethodField()
    selected_deduction_rule_ids = serializers.SerializerMethodField()

    class Meta:
        model = Payroll
        fields = (
            "id",
            "employee",
            "employee_name",
            "period_month",
            "period_year",
            "base_salary",
            "gross_salary",
            "allowances",
            "deductions",
            "net_salary",
            "status",
            "paid_at",
            "note",
            "components",
            "bonus_rule_ids",
            "benefit_rule_ids",
            "deduction_rule_ids",
            "bonus_amount_overrides",
            "benefit_amount_overrides",
            "deduction_amount_overrides",
            "selected_bonus_rule_ids",
            "selected_benefit_rule_ids",
            "selected_deduction_rule_ids",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "created_at",
            "updated_at",
            "base_salary",
            "gross_salary",
            "allowances",
            "deductions",
            "net_salary",
        )

    def get_employee_name(self, obj):
        full_name = obj.employee.user.get_full_name()
        return full_name or obj.employee.user.username

    def get_components(self, obj):
        components = obj.components.select_related("rule").all()
        return [
            {
                "id": str(component.id),
                "rule": str(component.rule_id),
                "name": component.rule.name,
                "category": component.rule.category,
                "amount": str(component.amount),
            }
            for component in components
        ]

    def get_selected_bonus_rule_ids(self, obj):
        return [
            str(component.rule_id)
            for component in obj.components.select_related("rule").filter(rule__category=PayrollRule.CATEGORY_BONUS)
        ]

    def get_selected_benefit_rule_ids(self, obj):
        return [
            str(component.rule_id)
            for component in obj.components.select_related("rule").filter(rule__category=PayrollRule.CATEGORY_BENEFIT)
        ]

    def get_selected_deduction_rule_ids(self, obj):
        return [
            str(component.rule_id)
            for component in obj.components.select_related("rule").filter(rule__category=PayrollRule.CATEGORY_DEDUCTION)
        ]

    def _active_contract_salary(self, employee):
        contract = (
            employee.contracts.filter(status=Contract.STATUS_ACTIVE)
            .order_by("-start_date", "-created_at")
            .first()
        )
        if not contract:
            contract = employee.contracts.order_by("-start_date", "-created_at").first()
        return contract.salary if contract else Decimal("0")

    def _extract_rule_ids(self, validated_data, instance=None):
        if instance is None:
            return (
                validated_data.pop("bonus_rule_ids", []),
                validated_data.pop("benefit_rule_ids", []),
                validated_data.pop("deduction_rule_ids", []),
            )
        has_bonus_ids = "bonus_rule_ids" in validated_data
        has_benefit_ids = "benefit_rule_ids" in validated_data
        has_deduction_ids = "deduction_rule_ids" in validated_data
        bonus_ids = validated_data.pop("bonus_rule_ids", None)
        benefit_ids = validated_data.pop("benefit_rule_ids", None)
        deduction_ids = validated_data.pop("deduction_rule_ids", None)
        if not has_bonus_ids:
            bonus_ids = self.get_selected_bonus_rule_ids(instance)
        if not has_benefit_ids:
            benefit_ids = self.get_selected_benefit_rule_ids(instance)
        if not has_deduction_ids:
            deduction_ids = self.get_selected_deduction_rule_ids(instance)
        return (bonus_ids, benefit_ids, deduction_ids)

    def _extract_overrides(self, validated_data, instance=None):
        if instance is None:
            return (
                validated_data.pop("bonus_amount_overrides", {}),
                validated_data.pop("benefit_amount_overrides", {}),
                validated_data.pop("deduction_amount_overrides", {}),
            )
        has_bonus_overrides = "bonus_amount_overrides" in validated_data
        has_benefit_overrides = "benefit_amount_overrides" in validated_data
        has_deduction_overrides = "deduction_amount_overrides" in validated_data
        bonus_overrides = validated_data.pop("bonus_amount_overrides", None)
        benefit_overrides = validated_data.pop("benefit_amount_overrides", None)
        deduction_overrides = validated_data.pop("deduction_amount_overrides", None)
        if not has_bonus_overrides:
            bonus_overrides = {}
        if not has_benefit_overrides:
            benefit_overrides = {}
        if not has_deduction_overrides:
            deduction_overrides = {}
        return (bonus_overrides, benefit_overrides, deduction_overrides)

    def _normalize_override_keys(self, overrides):
        if not overrides:
            return {}
        return {str(key): value for key, value in overrides.items()}

    def _resolve_rules(self, ids, expected_category):
        if not ids:
            return []
        rules = list(PayrollRule.objects.filter(id__in=ids, is_active=True))
        if len(rules) != len(set(str(i) for i in ids)):
            raise serializers.ValidationError("Certaines lignes de paie sont introuvables ou inactives.")
        invalid = [rule.name for rule in rules if rule.category != expected_category]
        if invalid:
            raise serializers.ValidationError(
                f"Regles invalides pour la categorie {expected_category}: {', '.join(invalid)}"
            )
        return rules

    def _resolve_component_amount(self, rule, overrides):
        return overrides.get(str(rule.id), rule.default_amount)

    def _apply_components_and_totals(
        self,
        payroll,
        bonus_rules,
        benefit_rules,
        deduction_rules,
        bonus_overrides,
        benefit_overrides,
        deduction_overrides,
    ):
        PayrollComponent.objects.filter(payroll=payroll).delete()

        bonus_total = Decimal("0")
        benefit_total = Decimal("0")
        deduction_total = Decimal("0")

        for rule in bonus_rules:
            amount = self._resolve_component_amount(rule, bonus_overrides)
            PayrollComponent.objects.create(payroll=payroll, rule=rule, amount=amount)
            bonus_total += amount
        for rule in benefit_rules:
            amount = self._resolve_component_amount(rule, benefit_overrides)
            PayrollComponent.objects.create(payroll=payroll, rule=rule, amount=amount)
            benefit_total += amount
        for rule in deduction_rules:
            amount = self._resolve_component_amount(rule, deduction_overrides)
            PayrollComponent.objects.create(payroll=payroll, rule=rule, amount=amount)
            deduction_total += amount

        allowances_total = bonus_total + benefit_total
        gross_salary = payroll.base_salary + allowances_total
        net_salary = gross_salary - deduction_total

        payroll.allowances = allowances_total
        payroll.deductions = deduction_total
        payroll.gross_salary = gross_salary
        payroll.net_salary = net_salary
        payroll.save(update_fields=["allowances", "deductions", "gross_salary", "net_salary", "updated_at"])

    def validate(self, attrs):
        period_month = attrs.get("period_month", getattr(self.instance, "period_month", None))
        period_year = attrs.get("period_year", getattr(self.instance, "period_year", None))
        if period_month and not 1 <= period_month <= 12:
            raise serializers.ValidationError({"period_month": "Le mois doit etre entre 1 et 12."})
        if period_year and period_year < 2000:
            raise serializers.ValidationError({"period_year": "Annee invalide."})
        return attrs

    def create(self, validated_data):
        bonus_rule_ids, benefit_rule_ids, deduction_rule_ids = self._extract_rule_ids(validated_data)
        bonus_overrides, benefit_overrides, deduction_overrides = self._extract_overrides(validated_data)
        payroll = Payroll.objects.create(**validated_data)
        payroll.base_salary = self._active_contract_salary(payroll.employee)
        payroll.save(update_fields=["base_salary", "updated_at"])

        bonus_rules = self._resolve_rules(bonus_rule_ids, PayrollRule.CATEGORY_BONUS)
        benefit_rules = self._resolve_rules(benefit_rule_ids, PayrollRule.CATEGORY_BENEFIT)
        deduction_rules = self._resolve_rules(deduction_rule_ids, PayrollRule.CATEGORY_DEDUCTION)
        self._apply_components_and_totals(
            payroll,
            bonus_rules,
            benefit_rules,
            deduction_rules,
            self._normalize_override_keys(bonus_overrides),
            self._normalize_override_keys(benefit_overrides),
            self._normalize_override_keys(deduction_overrides),
        )
        return payroll

    def update(self, instance, validated_data):
        bonus_rule_ids, benefit_rule_ids, deduction_rule_ids = self._extract_rule_ids(validated_data, instance=instance)
        bonus_overrides, benefit_overrides, deduction_overrides = self._extract_overrides(validated_data, instance=instance)
        instance = super().update(instance, validated_data)
        instance.base_salary = self._active_contract_salary(instance.employee)
        instance.save(update_fields=["base_salary", "updated_at"])
        bonus_rules = self._resolve_rules(bonus_rule_ids, PayrollRule.CATEGORY_BONUS)
        benefit_rules = self._resolve_rules(benefit_rule_ids, PayrollRule.CATEGORY_BENEFIT)
        deduction_rules = self._resolve_rules(deduction_rule_ids, PayrollRule.CATEGORY_DEDUCTION)
        self._apply_components_and_totals(
            instance,
            bonus_rules,
            benefit_rules,
            deduction_rules,
            self._normalize_override_keys(bonus_overrides),
            self._normalize_override_keys(benefit_overrides),
            self._normalize_override_keys(deduction_overrides),
        )
        return instance


class PayrollRuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = PayrollRule
        fields = (
            "id",
            "name",
            "code",
            "category",
            "default_amount",
            "description",
            "is_active",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("created_at", "updated_at")

