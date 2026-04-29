from django.db import models
from django.utils import timezone


class ExchangeRate(models.Model):
    """USD/ARS rate snapshots. `source` is e.g. 'dolarapi' or 'manual'."""

    SOURCE_API = "dolarapi"
    SOURCE_MANUAL = "manual"
    SOURCE_CHOICES = (
        (SOURCE_API, "DolarAPI"),
        (SOURCE_MANUAL, "Manual"),
    )

    rate = models.DecimalField(max_digits=14, decimal_places=4)
    source = models.CharField(max_length=32, choices=SOURCE_CHOICES, default=SOURCE_API)
    note = models.CharField(max_length=255, blank=True, default="")
    fetched_at = models.DateTimeField(default=timezone.now, db_index=True)
    payload = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ("-fetched_at",)

    def __str__(self) -> str:
        return f"{self.rate} ARS/USD ({self.source}) @ {self.fetched_at:%Y-%m-%d %H:%M}"
