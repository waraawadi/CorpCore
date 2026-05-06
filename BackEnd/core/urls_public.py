from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from rest_framework_simplejwt.views import TokenRefreshView

from api.auth_views import MeView, TenantTokenObtainPairView
from ged.office_views import GedOfficeCallbackView, GedOfficeFileDownloadView
from projects.file_views import ProjectFileCallbackView, ProjectFilePreviewView
from tenants.views import OnboardingViewSet


onboarding_create = OnboardingViewSet.as_view({"post": "create"})

urlpatterns = [
    path("api/ged/office-file/", GedOfficeFileDownloadView.as_view(), name="ged-office-file-public"),
    path("api/ged/office-callback/", GedOfficeCallbackView.as_view(), name="ged-office-callback-public"),
    path("api/projects/file-preview/", ProjectFilePreviewView.as_view(), name="projects-file-preview-public"),
    path("api/projects/file-callback/", ProjectFileCallbackView.as_view(), name="projects-file-callback-public"),
    path("admin/", admin.site.urls),
    path("api/auth/token/", TenantTokenObtainPairView.as_view(), name="public-token-obtain-pair"),
    path("api/auth/token/refresh/", TokenRefreshView.as_view(), name="public-token-refresh"),
    path("api/auth/me/", MeView.as_view(), name="public-auth-me"),
    path("api/public/onboarding/", onboarding_create, name="public-onboarding"),
    path("api/", include("api.urls_public")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
