from django.conf import settings
from django.contrib import admin
from django.conf.urls.static import static
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularRedocView, SpectacularSwaggerView
from rest_framework_simplejwt.views import TokenRefreshView

from api.auth_views import MeView, TenantTokenObtainPairView
from ged.office_views import GedOfficeCallbackView, GedOfficeFileDownloadView
from projects.file_views import ProjectFileCallbackView, ProjectFilePreviewView

urlpatterns = [
    path("api/ged/office-file/", GedOfficeFileDownloadView.as_view(), name="ged-office-file"),
    path("api/ged/office-callback/", GedOfficeCallbackView.as_view(), name="ged-office-callback"),
    path("api/projects/file-preview/", ProjectFilePreviewView.as_view(), name="projects-file-preview"),
    path("api/projects/file-callback/", ProjectFileCallbackView.as_view(), name="projects-file-callback"),
    path("admin/", admin.site.urls),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/swagger/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
    path("api/docs/redoc/", SpectacularRedocView.as_view(url_name="schema"), name="redoc"),
    path("api/auth/token/", TenantTokenObtainPairView.as_view(), name="token-obtain-pair"),
    path("api/auth/token/refresh/", TokenRefreshView.as_view(), name="token-refresh"),
    path("api/auth/me/", MeView.as_view(), name="auth-me"),
    path("api/", include("api.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
