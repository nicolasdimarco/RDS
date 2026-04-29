from rest_framework import mixins, viewsets

from accounts.permissions import IsAdminUserRole
from .models import AuditLog
from .serializers import AuditLogSerializer


class AuditLogViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    queryset = AuditLog.objects.all().select_related("user")
    serializer_class = AuditLogSerializer
    permission_classes = (IsAdminUserRole,)
    search_fields = ("action", "entity", "entity_id", "user__username")
    filterset_fields = ("action", "entity", "user")
    ordering_fields = ("created_at",)
