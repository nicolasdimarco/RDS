from decimal import Decimal

from django.db import transaction
from rest_framework import serializers

from currency.services import current_rate, to_usd
from stock.models import StockMovement
from stock.services import register_movement

from .models import Purchase, PurchaseItem, Supplier


class SupplierSerializer(serializers.ModelSerializer):
    class Meta:
        model = Supplier
        fields = (
            "id", "name", "tax_id", "contact_name", "email", "phone",
            "address", "notes", "created_at", "updated_at",
        )
        read_only_fields = ("created_at", "updated_at")


class PurchaseItemSerializer(serializers.ModelSerializer):
    product_sku = serializers.CharField(source="product.sku", read_only=True)
    product_name = serializers.CharField(source="product.name", read_only=True)

    class Meta:
        model = PurchaseItem
        fields = (
            "id", "product", "product_sku", "product_name",
            "quantity", "unit_cost", "discount_pct", "line_total",
        )
        read_only_fields = ("line_total", "product_sku", "product_name")


class PurchaseSerializer(serializers.ModelSerializer):
    items = PurchaseItemSerializer(many=True)
    supplier_name = serializers.CharField(source="supplier.name", read_only=True)

    class Meta:
        model = Purchase
        fields = (
            "id", "supplier", "supplier_name", "invoice_number",
            "purchase_date", "currency", "rate_used", "status",
            "extra_costs", "total", "total_usd", "notes",
            "items", "created_at", "updated_at",
        )
        read_only_fields = ("total", "total_usd", "created_at", "updated_at")

    def _compute_totals(self, purchase: Purchase, items: list[PurchaseItem]):
        subtotal = sum((it.line_total for it in items), Decimal("0"))
        total = (subtotal + Decimal(purchase.extra_costs or 0)).quantize(Decimal("0.01"))
        purchase.total = total
        purchase.total_usd = to_usd(total, purchase.currency, purchase.rate_used)

    @transaction.atomic
    def create(self, validated_data):
        items_data = validated_data.pop("items", [])
        if not validated_data.get("rate_used"):
            validated_data["rate_used"] = current_rate()
        request = self.context.get("request")
        user = request.user if request else None
        purchase = Purchase.objects.create(created_by=user, updated_by=user, **validated_data)

        items: list[PurchaseItem] = []
        for raw in items_data:
            item = PurchaseItem(purchase=purchase, **raw)
            item.line_total = item.compute_line_total()
            item.save()
            items.append(item)

        self._compute_totals(purchase, items)
        purchase.save(update_fields=["total", "total_usd"])

        if purchase.status == Purchase.STATUS_RECEIVED:
            self._apply_stock(purchase, items, user)
        return purchase

    @transaction.atomic
    def update(self, instance: Purchase, validated_data):
        items_data = validated_data.pop("items", None)
        request = self.context.get("request")
        user = request.user if request else None
        previous_status = instance.status

        for k, v in validated_data.items():
            setattr(instance, k, v)
        instance.updated_by = user

        if items_data is not None:
            instance.items.all().delete()
            items: list[PurchaseItem] = []
            for raw in items_data:
                item = PurchaseItem(purchase=instance, **raw)
                item.line_total = item.compute_line_total()
                item.save()
                items.append(item)
        else:
            items = list(instance.items.all())

        self._compute_totals(instance, items)
        instance.save()

        if previous_status != Purchase.STATUS_RECEIVED and instance.status == Purchase.STATUS_RECEIVED:
            self._apply_stock(instance, items, user)
        return instance

    def _apply_stock(self, purchase: Purchase, items, user):
        for item in items:
            register_movement(
                product=item.product,
                kind=StockMovement.KIND_PURCHASE,
                quantity=item.quantity,
                unit_cost=item.unit_cost,
                currency=purchase.currency,
                rate_used=purchase.rate_used,
                note=f"Compra #{purchase.id}",
                purchase=purchase,
                user=user,
            )
