from django.contrib import admin

from .models import Client, Project, ProjectItem, ProjectPayment


@admin.register(Client)
class ClientAdmin(admin.ModelAdmin):
    list_display = ("name", "tax_id", "email", "phone")
    search_fields = ("name", "tax_id", "email")


class ProjectItemInline(admin.TabularInline):
    model = ProjectItem
    extra = 0
    autocomplete_fields = ("product",)


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ("name", "client", "status", "date", "currency",
                    "total", "total_usd", "margin_pct", "stock_committed")
    list_filter = ("status", "currency", "stock_committed")
    search_fields = ("name", "client__name", "notes")
    date_hierarchy = "created_at"
    autocomplete_fields = ("client",)
    inlines = [ProjectItemInline]


@admin.register(ProjectPayment)
class ProjectPaymentAdmin(admin.ModelAdmin):
    list_display = ("project", "date", "amount", "currency", "amount_usd", "method")
    list_filter = ("method", "currency")
    search_fields = ("project__name", "notes")
    date_hierarchy = "date"
    autocomplete_fields = ("project",)
