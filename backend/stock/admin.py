from django.contrib import admin

from .models import StockMovement


@admin.register(StockMovement)
class StockMovementAdmin(admin.ModelAdmin):
    list_display = ("created_at", "product", "kind", "quantity", "unit_cost",
                    "currency", "created_by")
    list_filter = ("kind", "currency")
    search_fields = ("product__sku", "product__name", "note")
    date_hierarchy = "created_at"
    autocomplete_fields = ("product", "purchase", "created_by")
    raw_id_fields = ("project_item",)
