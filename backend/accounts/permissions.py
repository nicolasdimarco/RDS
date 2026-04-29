from rest_framework.permissions import BasePermission, SAFE_METHODS


class IsAdminUserRole(BasePermission):
    """Only users with role=admin or superusers."""

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and getattr(request.user, "is_admin", False))


class IsAdminOrReadOnly(BasePermission):
    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.method in SAFE_METHODS:
            return True
        return getattr(request.user, "is_admin", False)


class HasModulePermission(BasePermission):
    """Maps view's `required_perms` (dict by HTTP method) onto Django's perms.

    Admins always pass. Regular users must have the matching Django permission
    (e.g. 'products.add_product'). If a method has no entry, IsAuthenticated.
    """

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if getattr(request.user, "is_admin", False):
            return True
        required = getattr(view, "required_perms", {}) or {}
        codes = required.get(request.method, [])
        if not codes:
            return True
        return all(request.user.has_perm(code) for code in codes)
