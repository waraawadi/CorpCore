from django.urls import include, path
from rest_framework.routers import DefaultRouter

from tenants.views import TenantAdminViewSet
from .views import HealthCheckView

router = DefaultRouter()
router.register("tenants", TenantAdminViewSet, basename="tenants-admin")

urlpatterns = [
    path("health/", HealthCheckView.as_view(), name="public-health-check"),
    path("admin/", include(router.urls)),
    path("public/world/", include("worlddata.urls")),
]
