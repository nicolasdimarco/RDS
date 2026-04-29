from django.contrib import admin

from .models import Attachment


@admin.register(Attachment)
class AttachmentAdmin(admin.ModelAdmin):
    list_display = ("uploaded_at", "entity", "entity_id", "filename", "size", "uploaded_by")
    list_filter = ("entity",)
    search_fields = ("entity", "entity_id", "filename", "description")
    date_hierarchy = "uploaded_at"
