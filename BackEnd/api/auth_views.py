import logging

from rest_framework import permissions, response, serializers, views
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView

from django.contrib.auth import get_user_model
from tenants.models import Domain

from .emailing import send_login_notification_email


logger = logging.getLogger(__name__)


def _user_profile_photo_url(request, user) -> str | None:
    profile = None
    try:
        profile = user.employee_profile
    except Exception:
        profile = None
    if not profile or not getattr(profile, "profile_photo", None):
        return None
    try:
        return request.build_absolute_uri(profile.profile_photo.url) if request is not None else profile.profile_photo.url
    except Exception:
        return None


class TenantTokenObtainPairSerializer(TokenObtainPairSerializer):
    email = serializers.EmailField(required=True)
    password = serializers.CharField(write_only=True, required=True)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        username_field = self.fields.get(self.username_field)
        if username_field is not None:
            username_field.required = False
            username_field.allow_blank = True

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["email"] = user.email
        token["is_staff"] = bool(user.is_staff)
        return token

    def validate(self, attrs):
        email = (attrs.get("email") or "").strip().lower()
        if not email:
            raise serializers.ValidationError({"email": "Email requis."})

        User = get_user_model()
        user = User.objects.filter(email__iexact=email).first()
        if user is None:
            raise serializers.ValidationError({"detail": "Aucun compte actif trouve avec cet email et ce mot de passe."})

        attrs[self.username_field] = getattr(user, self.username_field, user.get_username())
        request = self.context.get("request")
        tenant = getattr(request, "tenant", None)
        host = request.get_host().split(":", 1)[0].lower() if request is not None else ""

        if tenant is not None and getattr(tenant, "schema_name", "") == "public" and host.endswith(".localhost"):
            if not Domain.objects.filter(domain__iexact=host).exists():
                available = Domain.objects.order_by("domain").values_list("domain", flat=True)[:1]
                suggestion = f" Utilise plutot http://{available[0]}:3000/login ." if available else ""
                raise serializers.ValidationError(
                    {"detail": f"Sous-domaine entreprise introuvable: '{host}'.{suggestion}"}
                )

        attrs.pop("email", None)
        data = super().validate(attrs)
        tenant = getattr(request, "tenant", None)
        data["user"] = {
            "id": self.user.id,
            "username": self.user.username,
            "email": self.user.email,
            "first_name": self.user.first_name,
            "last_name": self.user.last_name,
            "is_staff": self.user.is_staff,
            "is_superuser": self.user.is_superuser,
            "profile_photo": _user_profile_photo_url(request, self.user),
        }
        data["tenant"] = {
            "id": getattr(tenant, "id", None),
            "name": getattr(tenant, "name", None),
            "schema": getattr(tenant, "schema_name", "public"),
            "on_trial": getattr(tenant, "on_trial", None),
            "paid_until": getattr(tenant, "paid_until", None).isoformat() if getattr(tenant, "paid_until", None) else None,
        }
        try:
            send_login_notification_email(user=self.user, tenant=tenant, request=request)
        except Exception:
            # Never block login if email provider is unavailable.
            logger.exception("Failed to send login notification email for user=%s", getattr(self.user, "id", None))
        return data


class TenantTokenObtainPairView(TokenObtainPairView):
    serializer_class = TenantTokenObtainPairSerializer


class MeView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    class OutputSerializer(serializers.Serializer):
        id = serializers.IntegerField()
        username = serializers.CharField()
        email = serializers.EmailField()
        first_name = serializers.CharField()
        last_name = serializers.CharField()
        is_staff = serializers.BooleanField()
        is_superuser = serializers.BooleanField()
        is_company_admin = serializers.BooleanField()
        profile_photo = serializers.CharField(allow_null=True, required=False)
        tenant = serializers.DictField()

    def get(self, request):
        tenant = getattr(request, "tenant", None)
        emp = getattr(request.user, "employee_profile", None)
        payload = {
            "id": request.user.id,
            "username": request.user.username,
            "email": request.user.email,
            "first_name": request.user.first_name,
            "last_name": request.user.last_name,
            "is_staff": request.user.is_staff,
            "is_superuser": request.user.is_superuser,
            "is_company_admin": bool(emp and getattr(emp, "is_company_admin", False)),
            "profile_photo": _user_profile_photo_url(request, request.user),
            "tenant": {
                "id": getattr(tenant, "id", None),
                "name": getattr(tenant, "name", None),
                "schema": getattr(tenant, "schema_name", "public"),
                "on_trial": getattr(tenant, "on_trial", None),
                "paid_until": getattr(tenant, "paid_until", None).isoformat() if getattr(tenant, "paid_until", None) else None,
                "domain": tenant.domains.filter(is_primary=True).values_list("domain", flat=True).first()
                if tenant is not None and hasattr(tenant, "domains")
                else None,
            },
        }
        return response.Response(payload)
