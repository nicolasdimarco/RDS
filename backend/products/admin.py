from django.contrib import admin

from .models import Brand, Category, PriceHistory, Product


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "description")
    search_fields = ("name",)


@admin.register(Brand)
class BrandAdmin(admin.ModelAdmin):
    list_display = ("name",)
    search_fields = ("name",)


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ("sku", "name", "category", "stock_qty", "cost", "average_cost", "sale_price", "iva_pct", "is_active")
    list_filter = ("category", "brand", "is_active")
    search_fields = ("sku", "name")


@admin.register(PriceHistory)
class PriceHistoryAdmin(admin.ModelAdmin):
    list_display = ("product", "cost", "currency", "created_at")
