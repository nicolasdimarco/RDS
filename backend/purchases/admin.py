from django.contrib import admin

from .models import Purchase, PurchaseItem, Supplier


@admin.register(Supplier)
class SupplierAdmin(admin.ModelAdmin):
    list_display = ("name", "tax_id", "contact_name", "email", "phone")
    search_fields = ("name", "tax_id", "contact_name", "email")


class PurchaseItemInline(admin.TabularInline):
    model = PurchaseItem
    extra = 0
    autocomplete_fields = ("product",)


@admin.register(Purchase)
class PurchaseAdmin(admin.ModelAdmin):
    list_display = ("id", "supplier", "invoice_number", "purchase_date", "status",
                    "currency", "total", "total_usd")
    list_filter = ("status", "currency", "supplier")
    search_fields = ("invoice_number", "supplier__name", "notes")
    date_hierarchy = "purchase_date"
    autocomplete_fields = ("supplier",)
    inlines = [PurchaseItemInline]
