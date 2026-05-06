from django.contrib.auth import get_user_model
from django.db import transaction
from django_tenants.utils import schema_context
from rest_framework import permissions, serializers, status, viewsets
from rest_framework.exceptions import PermissionDenied
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Client, CompanyLegalProfile
from .serializers import CompanyProfileSerializer, OnboardingSerializer, TenantSerializer
from employees.models import EmployeeProfile


class OnboardingViewSet(viewsets.ViewSet):
    serializer_class = OnboardingSerializer
    permission_classes = [AllowAny]

    @transaction.atomic
    def create(self, request):
        serializer = self.serializer_class(data=request.data)
        serializer.is_valid(raise_exception=True)
        tenant = serializer.save()

        User = get_user_model()
        with schema_context(tenant.schema_name):
            admin_email = serializer.validated_data["admin_email"].strip().lower()
            admin_user, created = User.objects.get_or_create(
                username=admin_email,
                defaults={
                    "email": admin_email,
                    "is_staff": True,
                    "is_superuser": True,
                    "first_name": serializer.validated_data.get("first_name", ""),
                    "last_name": serializer.validated_data.get("last_name", ""),
                },
            )

            # Garantit que le compte admin est utilisable meme si le user existait deja.
            admin_user.email = admin_email
            admin_user.is_staff = True
            admin_user.is_superuser = True
            admin_user.first_name = serializer.validated_data.get("first_name", "")
            admin_user.last_name = serializer.validated_data.get("last_name", "")
            admin_user.set_password(serializer.validated_data["admin_password"])
            admin_user.save(update_fields=["email", "is_staff", "is_superuser", "first_name", "last_name", "password"])

            employee_profile, _ = EmployeeProfile.objects.update_or_create(
                user=admin_user,
                defaults={
                    "employee_number": serializer.validated_data.get("admin_employee_number", ""),
                    "nationality": serializer.validated_data["admin_nationality"],
                    "date_of_birth": serializer.validated_data["admin_date_of_birth"],
                    "place_of_birth": serializer.validated_data["admin_place_of_birth"],
                    "gender": serializer.validated_data["admin_gender"],
                    "marital_status": serializer.validated_data["admin_marital_status"],
                    "national_id_number": serializer.validated_data["admin_national_id_number"],
                    "id_document_type": serializer.validated_data.get("admin_id_document_type", ""),
                    "job_title": serializer.validated_data["admin_job_title"],
                    "department": serializer.validated_data["admin_department"],
                    "hire_date": serializer.validated_data["admin_hire_date"],
                    "professional_email": serializer.validated_data["admin_email"],
                    "phone_number": serializer.validated_data["admin_phone"],
                    "residential_country": serializer.validated_data["admin_residential_country"],
                    "residential_city": serializer.validated_data["admin_residential_city"],
                    "residential_address": serializer.validated_data["admin_residential_address"],
                    "is_company_admin": True,
                },
            )

            if not admin_user.pk or not employee_profile.pk:
                raise serializers.ValidationError(
                    {"detail": "Creation du compte admin entreprise ou du profil employe impossible."}
                )

        return Response(
            {
                "tenant_id": tenant.id,
                "name": tenant.name,
                "slug": tenant.slug,
                "schema_name": tenant.schema_name,
                "domain": tenant.domains.filter(is_primary=True).values_list("domain", flat=True).first(),
                "on_trial": tenant.on_trial,
                "paid_until": tenant.paid_until.isoformat() if tenant.paid_until else None,
                "currency_code": tenant.currency_code,
                "admin_user_id": admin_user.id,
                "admin_employee_profile_id": employee_profile.id,
                "admin_user_created": created,
                "trial_offer_days": 30,
            },
            status=status.HTTP_201_CREATED,
        )


class TenantAdminViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Client.objects.all()
    permission_classes = [IsAdminUser]
    serializer_class = TenantSerializer


def _user_is_company_admin(user) -> bool:
    if user.is_staff or user.is_superuser:
        return True
    emp = getattr(user, "employee_profile", None)
    return bool(emp and getattr(emp, "is_company_admin", False))


class CompanyProfileView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    writable_fields = (
        "name",
        "currency_code",
        "slogan",
        "legal_name",
        "registration_number",
        "tax_identification_number",
        "legal_status",
        "industry",
        "country",
        "city",
        "address_line",
        "postal_code",
        "company_email",
        "company_phone",
        "admin_phone",
        "representative_full_name",
        "representative_role",
        "representative_id_number",
    )

    def _build_payload(self, request, tenant, legal):
        return {
            "name": tenant.name,
            "slug": tenant.slug,
            "currency_code": tenant.currency_code,
            "slogan": tenant.slogan or "",
            "logo_url": request.build_absolute_uri(tenant.logo.url) if tenant.logo else "",
            "hero_image_url": request.build_absolute_uri(tenant.hero_image.url) if tenant.hero_image else "",
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

    def get(self, request):
        tenant = getattr(request, "tenant", None)
        if tenant is None or getattr(tenant, "schema_name", "public") == "public":
            raise PermissionDenied("Tenant entreprise introuvable.")
        if not _user_is_company_admin(request.user):
            raise PermissionDenied("Seul un admin entreprise peut consulter ce profil.")

        legal, _ = CompanyLegalProfile.objects.get_or_create(
            tenant=tenant,
            defaults={
                "legal_name": tenant.name,
                "country": "",
                "address_line": "",
                "company_email": request.user.email or "",
                "representative_full_name": f"{request.user.first_name} {request.user.last_name}".strip() or request.user.username,
            },
        )
        return Response(self._build_payload(request, tenant, legal))

    def patch(self, request):
        tenant = getattr(request, "tenant", None)
        if tenant is None or getattr(tenant, "schema_name", "public") == "public":
            raise PermissionDenied("Tenant entreprise introuvable.")
        if not _user_is_company_admin(request.user):
            raise PermissionDenied("Seul un admin entreprise peut modifier ce profil.")

        legal, _ = CompanyLegalProfile.objects.get_or_create(
            tenant=tenant,
            defaults={
                "legal_name": tenant.name,
                "country": "",
                "address_line": "",
                "company_email": request.user.email or "",
                "representative_full_name": f"{request.user.first_name} {request.user.last_name}".strip() or request.user.username,
            },
        )

        incoming = self._build_payload(request, tenant, legal)
        for field in self.writable_fields:
            if field in request.data:
                incoming[field] = request.data.get(field)
        if "logo" in request.FILES:
            incoming["logo"] = request.FILES.get("logo")
        if "hero_image" in request.FILES:
            incoming["hero_image"] = request.FILES.get("hero_image")
        serializer = CompanyProfileSerializer(data=incoming)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        tenant.name = data["name"]
        tenant.currency_code = data["currency_code"]
        tenant.slogan = data.get("slogan", "")
        if "logo" in request.FILES:
            tenant.logo = data.get("logo")
        if "hero_image" in request.FILES:
            tenant.hero_image = data.get("hero_image")
        tenant.save(update_fields=["name", "currency_code", "slogan", "logo", "hero_image", "updated_at"])

        legal.legal_name = data["legal_name"]
        legal.registration_number = data.get("registration_number", "")
        legal.tax_identification_number = data.get("tax_identification_number", "")
        legal.legal_status = data.get("legal_status", "")
        legal.industry = data.get("industry", "")
        legal.country = data["country"]
        legal.city = data.get("city", "")
        legal.address_line = data["address_line"]
        legal.postal_code = data.get("postal_code", "")
        legal.company_email = data["company_email"]
        legal.company_phone = data.get("company_phone", "")
        legal.admin_phone = data.get("admin_phone", "")
        legal.representative_full_name = data["representative_full_name"]
        legal.representative_role = data.get("representative_role", "")
        legal.representative_id_number = data.get("representative_id_number", "")
        legal.save()

        return Response(self._build_payload(request, tenant, legal))
