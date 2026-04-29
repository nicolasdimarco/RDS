from rest_framework import serializers

from .models import AuditLog


class AuditLogSerializer(serializers.ModelSerializer):
    user_username = serializers.CharField(source="user.username", default=None, read_only=True)

    class Meta:
        model = AuditLog
        fields = (
            "id", "user", "user_username", "action", "entity", "entity_id",
            "ip", "metadata", "created_at",
        )
        read_only_fields = fields
