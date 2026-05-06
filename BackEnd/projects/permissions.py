from rest_framework.permissions import SAFE_METHODS, BasePermission


class IsProjectReadOrMemberWrite(BasePermission):
    def has_permission(self, request, view):
        if request.user and request.user.is_superuser:
            return True
        if request.method in SAFE_METHODS:
            return bool(request.user and request.user.is_authenticated)
        return bool(request.user and request.user.is_authenticated and (request.user.is_staff or request.user.groups.exists()))
