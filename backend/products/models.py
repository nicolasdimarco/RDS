from decimal import Decimal

from django.conf import settings
from django.db import models

from rds_backend.common import (
    AuditedModel, CURRENCY_CHOICES, CURRENCY_USD, SoftDeleteModel,
)


class Category(AuditedModel, SoftDeleteModel):
    name = models.CharField(max_length=120, unique=True)
    description = models.CharField(max_length=255, blank=True, default="")

    class Meta:
        ordering = ("name",)
        verbose_name = "Categoría"
        verbose_name_plural = "Categorías"

    def __str__(self) -> str:
        return self.name


class Brand(AuditedModel, SoftDeleteModel):
    name = models.CharField(max_length=120, unique=True)

    class Meta:
        ordering = ("name",)
        verbose_name = "Marca"
        verbose_name_plural = "Marcas"

    def __str__(self) -> str:
        return self.name


class Product(AuditedModel, SoftDeleteModel):
    """Catalog item. Stock derives from `StockMovement` rows; we cache `stock_qty` for queries."""

    sku = models.CharField(max_length=64, unique=True)
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True, default="")
    category = models.ForeignKey(Category, on_delete=models.PROTECT, related_name="products")
    brand = models.ForeignKey(Brand, on_delete=models.PROTECT, related_name="products",
                              null=True, blank=True)

    unit = models.CharField(max_length=24, default="unidad")
    min_stock = models.PositiveIntegerField(default=0)
    stock_qty = models.IntegerField(default=0)  # cached, updated by stock service

    # Pricing snapshots (unit-level)
    cost_currency = models.CharField(max_length=3, choices=CURRENCY_CHOICES, default=CURRENCY_USD)
    cost = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))
    last_cost = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))
    average_cost = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))
    suggested_margin_pct = models.DecimalField(max_digits=6, decimal_places=2, default=Decimal("30"))
    sale_price = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))
    sale_currency = models.CharField(max_length=3, choices=CURRENCY_CHOICES, default=CURRENCY_USD)

    is_active = models.BooleanField(default=True)
    image = models.ImageField(upload_to="products/", null=True, blank=True)

    class Meta:
        ordering = ("name",)
        indexes = [models.Index(fields=["sku"]), models.Index(fields=["name"])]

    def __str__(self) -> str:
        return f"{self.sku} - {self.name}"

    @property
    def suggested_price(self) -> Decimal:
        margin = (self.suggested_margin_pct or Decimal("0")) / Decimal("100")
        return (self.average_cost * (Decimal("1") + margin)).quantize(Decimal("0.01"))


class PriceHistory(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="price_history")
    cost = models.DecimalField(max_digits=14, decimal_places=2)
    currency = models.CharField(max_length=3, choices=CURRENCY_CHOICES, default=CURRENCY_USD)
    rate_used = models.DecimalField(max_digits=14, decimal_places=4, null=True, blank=True)
    sale_price = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    sale_currency = models.CharField(max_length=3, choices=CURRENCY_CHOICES, default=CURRENCY_USD)
    note = models.CharField(max_length=255, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
                                   null=True, blank=True, related_name="price_history")

    class Meta:
        ordering = ("-created_at",)
