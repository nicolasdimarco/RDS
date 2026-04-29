from decimal import Decimal

from django.db import models

from rds_backend.common import (
    AuditedModel, CURRENCY_CHOICES, CURRENCY_USD, SoftDeleteModel,
)


class Client(AuditedModel, SoftDeleteModel):
    name = models.CharField(max_length=200)
    tax_id = models.CharField(max_length=64, blank=True, default="")
    email = models.EmailField(blank=True, default="")
    phone = models.CharField(max_length=64, blank=True, default="")
    address = models.CharField(max_length=255, blank=True, default="")
    notes = models.TextField(blank=True, default="")

    class Meta:
        ordering = ("name",)
        verbose_name = "Cliente"
        verbose_name_plural = "Clientes"

    def __str__(self) -> str:
        return self.name


class Project(AuditedModel, SoftDeleteModel):
    """Customer-facing project = quotation/sale + delivery/installation tracking."""

    STATUS_QUOTED = "quoted"
    STATUS_APPROVED = "approved"
    STATUS_IN_PROGRESS = "in_progress"
    STATUS_COMPLETED = "completed"
    STATUS_CANCELLED = "cancelled"
    STATUS_CHOICES = (
        (STATUS_QUOTED, "Cotizado"),
        (STATUS_APPROVED, "Aprobado"),
        (STATUS_IN_PROGRESS, "En curso"),
        (STATUS_COMPLETED, "Completado"),
        (STATUS_CANCELLED, "Cancelado"),
    )

    name = models.CharField(max_length=200, blank=True, default="")
    client = models.ForeignKey(Client, on_delete=models.PROTECT, related_name="projects")
    status = models.CharField(max_length=24, choices=STATUS_CHOICES, default=STATUS_QUOTED)
    date = models.DateField(null=True, blank=True)

    currency = models.CharField(max_length=3, choices=CURRENCY_CHOICES, default=CURRENCY_USD)
    rate_used = models.DecimalField(max_digits=14, decimal_places=4, null=True, blank=True)
    discount_pct = models.DecimalField(max_digits=6, decimal_places=2, default=Decimal("0"))
    extra_charges = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))

    subtotal = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))
    total = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))
    total_usd = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))
    cost_total = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))
    cost_total_usd = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))
    profit_usd = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))
    margin_pct = models.DecimalField(max_digits=8, decimal_places=2, default=Decimal("0"))

    stock_committed = models.BooleanField(default=False)
    notes = models.TextField(blank=True, default="")

    class Meta:
        ordering = ("-created_at",)
        verbose_name = "Proyecto"
        verbose_name_plural = "Proyectos"

    def __str__(self) -> str:
        return self.name or f"Proyecto #{self.pk}"


class ProjectItem(models.Model):
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="items")
    product = models.ForeignKey("products.Product", on_delete=models.PROTECT,
                                related_name="project_items")
    description = models.CharField(max_length=255, blank=True, default="")
    quantity = models.PositiveIntegerField()
    unit_price = models.DecimalField(max_digits=14, decimal_places=2)
    unit_cost = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))
    discount_pct = models.DecimalField(max_digits=6, decimal_places=2, default=Decimal("0"))
    line_total = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))
    line_cost_total = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))

    class Meta:
        ordering = ("id",)

    def compute_totals(self) -> None:
        gross = Decimal(self.unit_price) * Decimal(self.quantity)
        disc = (gross * Decimal(self.discount_pct or 0) / Decimal("100"))
        self.line_total = (gross - disc).quantize(Decimal("0.01"))
        self.line_cost_total = (
            Decimal(self.unit_cost) * Decimal(self.quantity)
        ).quantize(Decimal("0.01"))
