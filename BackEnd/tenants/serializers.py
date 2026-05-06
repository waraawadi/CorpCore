from datetime import timedelta

from django.conf import settings
from django.utils import timezone
from rest_framework import serializers

from subscriptions.models import BillingModule, TenantSubscription

from .models import Client, CompanyLegalProfile, Domain


class OnboardingSerializer(serializers.Serializer):
    company_name = serializers.CharField(max_length=200)
    slug = serializers.SlugField(max_length=63)
    admin_email = serializers.EmailField()
    admin_phone = serializers.CharField(max_length=40)
    admin_password = serializers.CharField(min_length=8, write_only=True)
    admin_nationality = serializers.CharField(max_length=120)
    admin_date_of_birth = serializers.DateField()
    admin_place_of_birth = serializers.CharField(max_length=120)
    admin_gender = serializers.ChoiceField(choices=("male", "female", "other"))
    admin_marital_status = serializers.ChoiceField(choices=("single", "married", "divorced", "widowed"))
    admin_national_id_number = serializers.CharField(max_length=120)
    admin_id_document_type = serializers.CharField(max_length=120, required=False, allow_blank=True, default="")
    admin_job_title = serializers.CharField(max_length=120)
    admin_department = serializers.CharField(max_length=120)
    admin_employee_number = serializers.CharField(max_length=60, required=False, allow_blank=True, default="")
    admin_hire_date = serializers.DateField()
    admin_residential_country = serializers.CharField(max_length=120)
    admin_residential_city = serializers.CharField(max_length=120)
    admin_residential_address = serializers.CharField(max_length=255)
    first_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    last_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    legal_name = serializers.CharField(max_length=255)
    registration_number = serializers.CharField(max_length=120, required=False, allow_blank=True)
    tax_identification_number = serializers.CharField(max_length=120, required=False, allow_blank=True)
    legal_status = serializers.CharField(max_length=120, required=False, allow_blank=True)
    industry = serializers.CharField(max_length=120, required=False, allow_blank=True)
    country = serializers.CharField(max_length=120)
    city = serializers.CharField(max_length=120, required=False, allow_blank=True)
    address_line = serializers.CharField(max_length=255)
    postal_code = serializers.CharField(max_length=20, required=False, allow_blank=True)
    company_email = serializers.EmailField()
    company_phone = serializers.CharField(max_length=40, required=False, allow_blank=True)
    representative_full_name = serializers.CharField(max_length=180)
    representative_role = serializers.CharField(max_length=120, required=False, allow_blank=True)
    representative_id_number = serializers.CharField(max_length=120, required=False, allow_blank=True)
    currency_code = serializers.CharField(max_length=3, required=False, default="XOF")

    def validate_slug(self, value: str) -> str:
        if value in {"admin", "app", "www"}:
            raise serializers.ValidationError("Sous-domaine reserve.")
        if Client.objects.filter(slug=value).exists():
            raise serializers.ValidationError("Ce sous-domaine existe deja.")
        return value

    def validate_currency_code(self, value: str) -> str:
        normalized = (value or "").strip().upper()
        if len(normalized) != 3 or not normalized.isalpha():
            raise serializers.ValidationError("Code devise invalide (format ISO 4217 attendu, ex: XOF, EUR).")
        return normalized

    def _ensure_default_modules(self) -> list[BillingModule]:
        defaults = [
            ("projects", "Gestion de Projets", 0),
            ("crm", "CRM", 25000),
            ("accounting", "Comptabilite", 35000),
            ("hr", "Ressources Humaines", 20000),
            ("payroll", "Paie", 20000),
            ("sales", "Ventes", 20000),
            ("procurement", "Achats", 20000),
            ("inventory", "Stocks", 25000),
            ("support", "Support", 15000),
            ("marketing", "Marketing", 15000),
            ("reports", "Rapports", 10000),
            ("ged", "GED", 15000),
            ("planning", "Planning", 10000),
        ]
        modules: list[BillingModule] = []
        for code, name, monthly_price_xof in defaults:
            module, _ = BillingModule.objects.get_or_create(
                code=code,
                defaults={
                    "name": name,
                    "monthly_price_xof": monthly_price_xof,
                    "is_active": True,
                },
            )
            modules.append(module)
        return modules

    def create(self, validated_data):
        slug = validated_data["slug"]
        now = timezone.now()
        trial_end = now + timedelta(days=30)
        tenant = Client.objects.create(
            schema_name=slug,
            slug=slug,
            name=validated_data["company_name"],
            currency_code=validated_data.get("currency_code", "XOF"),
            paid_until=trial_end.date(),
            on_trial=True,
        )
        Domain.objects.create(
            tenant=tenant,
            domain=f"{slug}.{getattr(settings, 'SITE_BASE_DOMAIN', 'corpcore.localhost')}",
            is_primary=True,
        )

        CompanyLegalProfile.objects.create(
            tenant=tenant,
            legal_name=validated_data["legal_name"],
            registration_number=validated_data.get("registration_number", ""),
            tax_identification_number=validated_data.get("tax_identification_number", ""),
            legal_status=validated_data.get("legal_status", ""),
            industry=validated_data.get("industry", ""),
            country=validated_data["country"],
            city=validated_data.get("city", ""),
            address_line=validated_data["address_line"],
            postal_code=validated_data.get("postal_code", ""),
            company_email=validated_data["company_email"],
            company_phone=validated_data.get("company_phone", ""),
            admin_phone=validated_data.get("admin_phone", ""),
            representative_full_name=validated_data["representative_full_name"],
            representative_role=validated_data.get("representative_role", ""),
            representative_id_number=validated_data.get("representative_id_number", ""),
        )

        modules = self._ensure_default_modules()
        for module in modules:
            TenantSubscription.objects.update_or_create(
                tenant=tenant,
                module=module,
                defaults={
                    "status": TenantSubscription.STATUS_ACTIVE,
                    "started_at": now,
                    "renewal_at": trial_end,
                    "grace_until": trial_end + timedelta(days=3),
                    "auto_renew": False,
                    "metadata": {"trial": True, "trial_offer_days": 30},
                },
            )

        return tenant


class TenantSerializer(serializers.ModelSerializer):
    primary_domain = serializers.SerializerMethodField()
    legal_profile = serializers.SerializerMethodField()

    class Meta:
        model = Client
        fields = (
            "id",
            "name",
            "slug",
            "schema_name",
            "on_trial",
            "paid_until",
            "created_at",
            "currency_code",
            "primary_domain",
            "legal_profile",
        )

    def get_primary_domain(self, obj):
        return obj.domains.filter(is_primary=True).values_list("domain", flat=True).first()

    def get_legal_profile(self, obj):
        try:
            legal = obj.legal_profile
        except CompanyLegalProfile.DoesNotExist:
            return None
        return {
            "legal_name": legal.legal_name,
            "registration_number": legal.registration_number,
            "tax_identification_number": legal.tax_identification_number,
            "legal_status": legal.legal_status,
            "industry": legal.industry,
            "country": legal.country,
            "city": legal.city,
            "address_line": legal.address_line,
            "postal_code": legal.postal_code,
            "company_email": legal.company_email,
            "company_phone": legal.company_phone,
            "admin_phone": legal.admin_phone,
            "representative_full_name": legal.representative_full_name,
            "representative_role": legal.representative_role,
            "representative_id_number": legal.representative_id_number,
        }


class CompanyProfileSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=200)
    slug = serializers.CharField(read_only=True)
    currency_code = serializers.CharField(max_length=3)
    slogan = serializers.CharField(max_length=255, allow_blank=True, required=False)
    logo = serializers.ImageField(required=False, allow_null=True)
    hero_image = serializers.ImageField(required=False, allow_null=True)
    logo_url = serializers.CharField(read_only=True)
    hero_image_url = serializers.CharField(read_only=True)
    legal_name = serializers.CharField(max_length=255)
    registration_number = serializers.CharField(max_length=120, allow_blank=True, required=False)
    tax_identification_number = serializers.CharField(max_length=120, allow_blank=True, required=False)
    legal_status = serializers.CharField(max_length=120, allow_blank=True, required=False)
    industry = serializers.CharField(max_length=120, allow_blank=True, required=False)
    country = serializers.CharField(max_length=120)
    city = serializers.CharField(max_length=120, allow_blank=True, required=False)
    address_line = serializers.CharField(max_length=255)
    postal_code = serializers.CharField(max_length=20, allow_blank=True, required=False)
    company_email = serializers.EmailField()
    company_phone = serializers.CharField(max_length=40, allow_blank=True, required=False)
    admin_phone = serializers.CharField(max_length=40, allow_blank=True, required=False)
    representative_full_name = serializers.CharField(max_length=180)
    representative_role = serializers.CharField(max_length=120, allow_blank=True, required=False)
    representative_id_number = serializers.CharField(max_length=120, allow_blank=True, required=False)

    def validate_currency_code(self, value: str) -> str:
        normalized = (value or "").strip().upper()
        if len(normalized) != 3 or not normalized.isalpha():
            raise serializers.ValidationError("Code devise invalide (format ISO 4217 attendu, ex: XOF, EUR).")
        return normalized

