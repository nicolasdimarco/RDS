from django.contrib import admin

from .models import AuditLog


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ("created_at", "user", "action", "entity", "entity_id", "ip")
    list_filter = ("action", "entity")
    search_fields = ("user__username", "entity", "entity_id")
    date_hierarchy = "created_at"
    readonly_fields = ("user", "action", "entity", "entity_id", "ip", "metadata", "created_at")

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
