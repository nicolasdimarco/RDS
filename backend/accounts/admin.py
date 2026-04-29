from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import User


@admin.register(User)
class CustomUserAdmin(UserAdmin):
    list_display = ("username", "email", "role", "is_active", "is_superuser")
    list_filter = ("role", "is_active", "is_superuser")
    fieldsets = UserAdmin.fieldsets + (
        ("RDS", {"fields": ("role", "phone", "dark_mode")}),
    )
