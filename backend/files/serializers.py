import os

from django.conf import settings
from rest_framework import serializers

from .models import Attachment


class AttachmentSerializer(serializers.ModelSerializer):
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = Attachment
        fields = (
            "id", "entity", "entity_id", "file", "file_url", "filename",
            "content_type", "size", "description",
            "uploaded_at", "uploaded_by",
        )
        read_only_fields = ("filename", "size", "uploaded_at", "uploaded_by", "file_url",
                            "content_type")

    def get_file_url(self, obj: Attachment) -> str | None:
        request = self.context.get("request")
        if not obj.file:
            return None
        url = obj.file.url
        if request is not None:
            return request.build_absolute_uri(url)
        return url

    def validate_file(self, value):
        max_bytes = settings.MAX_UPLOAD_MB * 1024 * 1024
        if value.size > max_bytes:
            raise serializers.ValidationError(
                f"Tamaño máximo {settings.MAX_UPLOAD_MB} MB."
            )
        ext = os.path.splitext(value.name)[1].lower().lstrip(".")
        if ext not in settings.ALLOWED_UPLOAD_EXTENSIONS:
            raise serializers.ValidationError(
                f"Formato no permitido. Permitidos: {', '.join(settings.ALLOWED_UPLOAD_EXTENSIONS)}"
            )
        return value
