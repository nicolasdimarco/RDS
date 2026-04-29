from decimal import Decimal

from rest_framework import serializers

from currency.services import to_usd
from .models import Brand, Category, PriceHistory, Product


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ("id", "name", "description", "created_at", "updated_at")
        read_only_fields = ("created_at", "updated_at")


class BrandSerializer(serializers.ModelSerializer):
    class Meta:
        model = Brand
        fields = ("id", "name", "created_at", "updated_at")
        read_only_fields = ("created_at", "updated_at")


class ProductSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.name", read_only=True)
    brand_name = serializers.CharField(source="brand.name", read_only=True, default=None)
    suggested_price = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)
    cost = serializers.DecimalField(max_digits=14, decimal_places=2, required=True)
    iva_pct = serializers.DecimalField(max_digits=5, decimal_places=2, required=False)
    average_cost_usd = serializers.SerializerMethodField()
    sale_price_usd = serializers.SerializerMethodField()
    margin_pct = serializers.SerializerMethodField()
    low_stock = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = (
            "id", "sku", "name", "description",
            "category", "category_name", "brand", "brand_name",
            "unit", "min_stock", "stock_qty", "low_stock",
            "cost_currency", "cost", "last_cost", "average_cost",
            "suggested_margin_pct", "suggested_price",
            "sale_price", "sale_currency", "iva_pct",
            "average_cost_usd", "sale_price_usd", "margin_pct",
            "is_active", "image",
            "created_at", "updated_at",
        )
        read_only_fields = ("stock_qty", "average_cost", "last_cost", "created_at", "updated_at")

    def get_average_cost_usd(self, obj: Product) -> str:
        return str(to_usd(obj.average_cost, obj.cost_currency))

    def get_sale_price_usd(self, obj: Product) -> str:
        return str(to_usd(obj.sale_price, obj.sale_currency))

    def get_margin_pct(self, obj: Product) -> str:
        cost_usd = to_usd(obj.cost, obj.cost_currency)
        if not cost_usd or cost_usd <= 0:
            return "0.00"
        sale_usd = to_usd(obj.sale_price, obj.sale_currency)
        return str(((sale_usd - cost_usd) / cost_usd * Decimal("100")).quantize(Decimal("0.01")))

    def get_low_stock(self, obj: Product) -> bool:
        return obj.stock_qty <= (obj.min_stock or 0)

    def validate_sku(self, value: str) -> str:
        value = (value or "").strip()
        if not value:
            raise serializers.ValidationError("El SKU es obligatorio.")
        return value

    def validate_name(self, value: str) -> str:
        value = (value or "").strip()
        if not value:
            raise serializers.ValidationError("El nombre es obligatorio.")
        return value

    def validate_min_stock(self, value: int) -> int:
        if value is None or value < 0:
            raise serializers.ValidationError("El stock mínimo no puede ser negativo.")
        return value

    def validate_cost(self, value: Decimal) -> Decimal:
        if value is None or value < Decimal("0"):
            raise serializers.ValidationError("El costo no puede ser negativo.")
        return value

    def validate_sale_price(self, value: Decimal) -> Decimal:
        if value is None or value < Decimal("0"):
            raise serializers.ValidationError("El precio de venta no puede ser negativo.")
        return value

    def validate_suggested_margin_pct(self, value: Decimal) -> Decimal:
        if value is None or value < Decimal("0") or value > Decimal("1000"):
            raise serializers.ValidationError("El margen debe estar entre 0 y 1000.")
        return value

    def validate_iva_pct(self, value: Decimal) -> Decimal:
        allowed = {Decimal("21.00"), Decimal("10.50")}
        if value is None or Decimal(value).quantize(Decimal("0.01")) not in allowed:
            raise serializers.ValidationError("El IVA debe ser 21% o 10.5%.")
        return Decimal(value).quantize(Decimal("0.01"))


class PriceHistorySerializer(serializers.ModelSerializer):
    product_sku = serializers.CharField(source="product.sku", read_only=True)
    product_name = serializers.CharField(source="product.name", read_only=True)

    class Meta:
        model = PriceHistory
        fields = (
            "id", "product", "product_sku", "product_name",
            "cost", "currency", "rate_used",
            "sale_price", "sale_currency",
            "note", "created_at", "created_by",
        )
        read_only_fields = ("created_at", "created_by")
