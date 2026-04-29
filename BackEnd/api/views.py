from django.utils import timezone
from rest_framework import permissions, response, views


class HealthCheckView(views.APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def get(self, request):
        tenant = getattr(request, "tenant", None)
        return response.Response(
            {
                "status": "ok",
                "timestamp": timezone.now().isoformat(),
                "schema": getattr(tenant, "schema_name", "public"),
                "tenant": getattr(tenant, "name", None),
            }
        )
