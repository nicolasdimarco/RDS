from decimal import Decimal

from django.db import models

from rds_backend.common import (
    AuditedModel, CURRENCY_CHOICES, CURRENCY_USD, SoftDeleteModel,
)


class Supplier(AuditedModel, SoftDeleteModel):
    name = models.CharField(max_length=200, unique=True)
    tax_id = models.CharField(max_length=64, blank=True, default="")
    contact_name = models.CharField(max_length=120, blank=True, default="")
    email = models.EmailField(blank=True, default="")
    phone = models.CharField(max_length=64, blank=True, default="")
    address = models.CharField(max_length=255, blank=True, default="")
    notes = models.TextField(blank=True, default="")

    class Meta:
        ordering = ("name",)
        verbose_name = "Proveedor"
        verbose_name_plural = "Proveedores"

    def __str__(self) -> str:
        return self.name


class Purchase(AuditedModel, SoftDeleteModel):
    """Header for one purchase to a supplier; lines are PurchaseItem."""

    STATUS_DRAFT = "draft"
    STATUS_RECEIVED = "received"
    STATUS_CANCELLED = "cancelled"
    STATUS_CHOICES = (
        (STATUS_DRAFT, "Borrador"),
        (STATUS_RECEIVED, "Recibida"),
        (STATUS_CANCELLED, "Anulada"),
    )

    supplier = models.ForeignKey(Supplier, on_delete=models.PROTECT, related_name="purchases")
    invoice_number = models.CharField(max_length=80, blank=True, default="")
    purchase_date = models.DateField()
    currency = models.CharField(max_length=3, choices=CURRENCY_CHOICES, default=CURRENCY_USD)
    rate_used = models.DecimalField(max_digits=14, decimal_places=4, null=True, blank=True,
                                    help_text="USD/ARS al momento de la operación.")
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default=STATUS_DRAFT)
    extra_costs = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"),
                                      help_text="Flete/impuestos a prorratear.")
    total = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))
    total_usd = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))
    notes = models.TextField(blank=True, default="")

    class Meta:
        ordering = ("-purchase_date", "-id")
        verbose_name = "Compra"
        verbose_name_plural = "Compras"

    def __str__(self) -> str:
        return f"Compra #{self.id} {self.supplier_id} {self.purchase_date}"


class PurchaseItem(models.Model):
    purchase = models.ForeignKey(Purchase, on_delete=models.CASCADE, related_name="items")
    product = models.ForeignKey("products.Product", on_delete=models.PROTECT,
                                related_name="purchase_items")
    quantity = models.PositiveIntegerField()
    unit_cost = models.DecimalField(max_digits=14, decimal_places=2)
    discount_pct = models.DecimalField(max_digits=6, decimal_places=2, default=Decimal("0"))
    line_total = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))

    class Meta:
        ordering = ("id",)

    def compute_line_total(self) -> Decimal:
        gross = Decimal(self.unit_cost) * Decimal(self.quantity)
        disc = (gross * Decimal(self.discount_pct or 0) / Decimal("100"))
        return (gross - disc).quantize(Decimal("0.01"))
