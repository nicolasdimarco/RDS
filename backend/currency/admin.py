from django.contrib import admin

from .models import ExchangeRate


@admin.register(ExchangeRate)
class ExchangeRateAdmin(admin.ModelAdmin):
    list_display = ("fetched_at", "rate", "source", "note")
    list_filter = ("source",)
    date_hierarchy = "fetched_at"
