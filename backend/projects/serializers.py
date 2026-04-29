from decimal import Decimal

from django.db import transaction
from rest_framework import serializers

from currency.services import current_rate, to_usd
from stock.models import StockMovement
from stock.services import register_movement

from .models import Client, Project, ProjectItem, ProjectPayment


class ClientSerializer(serializers.ModelSerializer):
    class Meta:
        model = Client
        fields = (
            "id", "name", "tax_id", "email", "phone", "address", "notes",
            "created_at", "updated_at",
        )
        read_only_fields = ("created_at", "updated_at")

    def validate_name(self, value: str) -> str:
        value = (value or "").strip()
        if not value:
            raise serializers.ValidationError("El nombre del cliente es obligatorio.")
        if len(value) > 200:
            raise serializers.ValidationError("El nombre no puede superar 200 caracteres.")
        return value

    def validate_tax_id(self, value: str) -> str:
        value = (value or "").strip()
        if value and len(value) > 64:
            raise serializers.ValidationError("El identificador fiscal no puede superar 64 caracteres.")
        return value

    def validate_email(self, value: str) -> str:
        return (value or "").strip()

    def validate_phone(self, value: str) -> str:
        value = (value or "").strip()
        if value and len(value) > 64:
            raise serializers.ValidationError("El teléfono no puede superar 64 caracteres.")
        return value

    def validate_address(self, value: str) -> str:
        value = (value or "").strip()
        if value and len(value) > 255:
            raise serializers.ValidationError("La dirección no puede superar 255 caracteres.")
        return value


class ProjectItemSerializer(serializers.ModelSerializer):
    product_sku = serializers.CharField(source="product.sku", read_only=True)
    product_name = serializers.CharField(source="product.name", read_only=True)

    class Meta:
        model = ProjectItem
        fields = (
            "id", "project", "product", "product_sku", "product_name",
            "description", "quantity", "unit_price", "unit_cost",
            "discount_pct", "line_total", "line_cost_total",
        )
        read_only_fields = ("project", "line_total", "line_cost_total",
                            "product_sku", "product_name")


class ProjectPaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProjectPayment
        fields = (
            "id", "project", "date", "amount", "currency", "rate_used",
            "amount_usd", "method", "notes", "created_at", "updated_at",
        )
        read_only_fields = ("amount_usd", "created_at", "updated_at")

    def create(self, validated_data):
        if not validated_data.get("rate_used"):
            validated_data["rate_used"] = current_rate()
        request = self.context.get("request")
        user = request.user if request else None
        validated_data["amount_usd"] = to_usd(
            validated_data["amount"],
            validated_data["currency"],
            validated_data.get("rate_used"),
        )
        return ProjectPayment.objects.create(created_by=user, updated_by=user, **validated_data)

    def update(self, instance, validated_data):
        for k, v in validated_data.items():
            setattr(instance, k, v)
        request = self.context.get("request")
        if request:
            instance.updated_by = request.user
        instance.amount_usd = to_usd(instance.amount, instance.currency, instance.rate_used)
        instance.save()
        return instance


class ProjectSerializer(serializers.ModelSerializer):
    items = ProjectItemSerializer(many=True)
    client_name = serializers.CharField(source="client.name", read_only=True)
    paid_usd = serializers.SerializerMethodField()
    paid_pct = serializers.SerializerMethodField()
    balance_usd = serializers.SerializerMethodField()

    class Meta:
        model = Project
        fields = (
            "id", "name", "client", "client_name", "status",
            "date",
            "currency", "rate_used", "discount_pct", "extra_charges",
            "subtotal", "total", "total_usd",
            "cost_total", "cost_total_usd", "profit_usd", "margin_pct",
            "paid_usd", "paid_pct", "balance_usd",
            "stock_committed", "notes", "items",
            "created_at", "updated_at",
        )
        read_only_fields = (
            "name",
            "subtotal", "total", "total_usd",
            "cost_total", "cost_total_usd", "profit_usd", "margin_pct",
            "paid_usd", "paid_pct", "balance_usd",
            "stock_committed", "created_at", "updated_at",
        )

    def get_paid_usd(self, obj: Project) -> str:
        total = sum((p.amount_usd for p in obj.payments.all()), Decimal("0"))
        return str(total.quantize(Decimal("0.01")))

    def get_paid_pct(self, obj: Project) -> str:
        paid = Decimal(self.get_paid_usd(obj))
        if obj.total_usd and obj.total_usd > 0:
            return str((paid / obj.total_usd * Decimal("100")).quantize(Decimal("0.01")))
        return "0.00"

    def get_balance_usd(self, obj: Project) -> str:
        paid = Decimal(self.get_paid_usd(obj))
        return str((obj.total_usd - paid).quantize(Decimal("0.01")))

    def _recalculate(self, project: Project, items: list[ProjectItem]) -> None:
        subtotal = sum((it.line_total for it in items), Decimal("0"))
        cost_total = sum((it.line_cost_total for it in items), Decimal("0"))
        global_disc = subtotal * Decimal(project.discount_pct or 0) / Decimal("100")
        total = (subtotal - global_disc + Decimal(project.extra_charges or 0)).quantize(Decimal("0.01"))

        project.subtotal = subtotal.quantize(Decimal("0.01"))
        project.cost_total = cost_total.quantize(Decimal("0.01"))
        project.total = total
        project.total_usd = to_usd(total, project.currency, project.rate_used)
        project.cost_total_usd = to_usd(project.cost_total, project.currency, project.rate_used)
        project.profit_usd = (project.total_usd - project.cost_total_usd).quantize(Decimal("0.01"))
        if project.total_usd and project.total_usd > 0:
            project.margin_pct = (project.profit_usd / project.total_usd * Decimal("100")).quantize(Decimal("0.01"))
        else:
            project.margin_pct = Decimal("0")

    @transaction.atomic
    def create(self, validated_data):
        items_data = validated_data.pop("items", [])
        if not validated_data.get("rate_used"):
            validated_data["rate_used"] = current_rate()
        request = self.context.get("request")
        user = request.user if request else None
        project = Project.objects.create(created_by=user, updated_by=user, **validated_data)
        project.name = self._auto_name(project)

        items = self._save_items(project, items_data)
        self._recalculate(project, items)
        project.save()

        if project.status == Project.STATUS_COMPLETED and not project.stock_committed:
            self._commit_stock(project, items, user)
        return project

    @transaction.atomic
    def update(self, instance: Project, validated_data):
        items_data = validated_data.pop("items", None)
        request = self.context.get("request")
        user = request.user if request else None
        was_committed = instance.stock_committed
        previous_status = instance.status

        for k, v in validated_data.items():
            setattr(instance, k, v)
        instance.updated_by = user
        instance.name = self._auto_name(instance)

        if items_data is not None:
            instance.items.all().delete()
            items = self._save_items(instance, items_data)
        else:
            items = list(instance.items.all())

        self._recalculate(instance, items)
        instance.save()

        if (not was_committed
                and previous_status != Project.STATUS_COMPLETED
                and instance.status == Project.STATUS_COMPLETED):
            self._commit_stock(instance, items, user)
        return instance

    def _save_items(self, project: Project, raw_items) -> list[ProjectItem]:
        items: list[ProjectItem] = []
        for raw in raw_items:
            unit_cost = raw.get("unit_cost")
            if unit_cost in (None, "", 0, Decimal("0")):
                # Default to product's average cost (USD) converted to project currency
                product = raw["product"]
                if project.currency == "USD":
                    unit_cost = product.average_cost if product.cost_currency == "USD" else \
                        to_usd(product.average_cost, product.cost_currency, project.rate_used)
                else:
                    rate = Decimal(project.rate_used or 0) or current_rate()
                    base_usd = to_usd(product.average_cost, product.cost_currency, project.rate_used)
                    unit_cost = (base_usd * rate).quantize(Decimal("0.01"))
                raw["unit_cost"] = unit_cost
            item = ProjectItem(project=project, **raw)
            item.compute_totals()
            item.save()
            items.append(item)
        return items

    @staticmethod
    def _auto_name(project: Project) -> str:
        client_name = project.client.name if project.client_id else ""
        return f"#{project.pk} - {client_name}".strip(" -")

    def _commit_stock(self, project: Project, items, user) -> None:
        for item in items:
            register_movement(
                product=item.product,
                kind=StockMovement.KIND_SALE,
                quantity=-int(item.quantity),
                unit_cost=item.unit_cost,
                currency=project.currency,
                rate_used=project.rate_used,
                note=f"Proyecto {project.name or project.pk}",
                project_item=item,
                user=user,
            )
        project.stock_committed = True
        project.save(update_fields=["stock_committed"])
