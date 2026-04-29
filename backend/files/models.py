import os
from django.conf import settings
from django.db import models


def attachment_upload_to(instance, filename: str) -> str:
    folder = instance.entity or "misc"
    return f"attachments/{folder}/{instance.entity_id or 'na'}/{filename}"


class Attachment(models.Model):
    """Generic file attached to either a purchase or a project."""

    ENTITY_PURCHASE = "purchase"
    ENTITY_PROJECT = "project"
    ENTITY_PRODUCT = "product"
    ENTITY_CHOICES = (
        (ENTITY_PURCHASE, "Compra"),
        (ENTITY_PROJECT, "Proyecto"),
        (ENTITY_PRODUCT, "Producto"),
    )

    entity = models.CharField(max_length=24, choices=ENTITY_CHOICES)
    entity_id = models.CharField(max_length=64)
    file = models.FileField(upload_to=attachment_upload_to)
    filename = models.CharField(max_length=255, blank=True, default="")
    content_type = models.CharField(max_length=120, blank=True, default="")
    size = models.PositiveIntegerField(default=0)
    description = models.CharField(max_length=255, blank=True, default="")

    uploaded_at = models.DateTimeField(auto_now_add=True)
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="attachments",
    )

    class Meta:
        ordering = ("-uploaded_at",)
        indexes = [models.Index(fields=["entity", "entity_id"])]

    def save(self, *args, **kwargs):
        if self.file and not self.filename:
            self.filename = os.path.basename(self.file.name)
        if self.file and not self.size:
            try:
                self.size = self.file.size
            except Exception:  # noqa: BLE001
                pass
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"{self.entity}#{self.entity_id} {self.filename}"
