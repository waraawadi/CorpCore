from django.contrib.auth import get_user_model
from django.db import transaction
from django_tenants.utils import schema_context
from rest_framework import serializers, status, viewsets
from rest_framework.permissions import AllowAny, IsAdminUser
from rest_framework.response import Response

from .models import Client
from .serializers import OnboardingSerializer, TenantSerializer
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
