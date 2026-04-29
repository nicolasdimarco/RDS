from rest_framework import serializers

from .models import StockMovement
from .services import register_movement


class StockMovementSerializer(serializers.ModelSerializer):
    product_sku = serializers.CharField(source="product.sku", read_only=True)
    product_name = serializers.CharField(source="product.name", read_only=True)

    class Meta:
        model = StockMovement
        fields = (
            "id", "product", "product_sku", "product_name",
            "kind", "quantity", "unit_cost", "currency", "rate_used",
            "note", "purchase", "project_item",
            "created_at", "created_by",
        )
        read_only_fields = ("created_at", "created_by", "purchase", "project_item",
                            "product_sku", "product_name")

    def create(self, validated_data):
        request = self.context.get("request")
        user = request.user if request else None
        return register_movement(
            product=validated_data["product"],
            kind=validated_data["kind"],
            quantity=validated_data["quantity"],
            unit_cost=validated_data.get("unit_cost", 0),
            currency=validated_data.get("currency", "USD"),
            rate_used=validated_data.get("rate_used"),
            note=validated_data.get("note", ""),
            user=user,
        )
