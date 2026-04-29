from decimal import Decimal

from django.conf import settings
from django.db import models

from rds_backend.common import CURRENCY_CHOICES, CURRENCY_USD


class StockMovement(models.Model):
    """Single source of truth for stock changes (purchase, sale, adjustment, etc.)."""

    KIND_PURCHASE = "purchase"
    KIND_SALE = "sale"
    KIND_RETURN_IN = "return_in"
    KIND_RETURN_OUT = "return_out"
    KIND_ADJUSTMENT = "adjustment"
    KIND_INITIAL = "initial"
    KIND_CHOICES = (
        (KIND_PURCHASE, "Compra"),
        (KIND_SALE, "Venta"),
        (KIND_RETURN_IN, "Devolución a stock"),
        (KIND_RETURN_OUT, "Devolución a proveedor"),
        (KIND_ADJUSTMENT, "Ajuste"),
        (KIND_INITIAL, "Inicial"),
    )

    product = models.ForeignKey(
        "products.Product", on_delete=models.PROTECT, related_name="stock_movements",
    )
    kind = models.CharField(max_length=24, choices=KIND_CHOICES)
    quantity = models.IntegerField(help_text="Positivo entra, negativo sale.")
    unit_cost = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))
    currency = models.CharField(max_length=3, choices=CURRENCY_CHOICES, default=CURRENCY_USD)
    rate_used = models.DecimalField(max_digits=14, decimal_places=4, null=True, blank=True)
    note = models.CharField(max_length=255, blank=True, default="")

    purchase = models.ForeignKey(
        "purchases.Purchase", on_delete=models.SET_NULL, related_name="movements",
        null=True, blank=True,
    )
    project_item = models.ForeignKey(
        "projects.ProjectItem", on_delete=models.SET_NULL, related_name="movements",
        null=True, blank=True,
    )

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="stock_movements_created",
    )

    class Meta:
        ordering = ("-created_at",)
        indexes = [models.Index(fields=["product", "kind"])]

    def __str__(self) -> str:
        return f"{self.kind} {self.product_id} qty={self.quantity}"
