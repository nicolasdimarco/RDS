"""Idempotently create/update the initial admin user from env vars."""
import os

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Crea o actualiza el usuario admin a partir de RDS_ADMIN_USERNAME/EMAIL/PASSWORD."

    def handle(self, *args, **options):
        username = os.getenv("RDS_ADMIN_USERNAME")
        email = os.getenv("RDS_ADMIN_EMAIL")
        password = os.getenv("RDS_ADMIN_PASSWORD")

        if not username or not password:
            self.stdout.write(self.style.WARNING(
                "RDS_ADMIN_USERNAME o RDS_ADMIN_PASSWORD no definidos; salteando."
            ))
            return

        User = get_user_model()
        user, created = User.objects.get_or_create(
            username=username,
            defaults={
                "email": email or f"{username}@rds.local",
                "role": User.ROLE_ADMIN,
                "is_staff": True,
                "is_superuser": True,
                "is_active": True,
            },
        )
        user.email = email or user.email
        user.role = User.ROLE_ADMIN
        user.is_staff = True
        user.is_superuser = True
        user.is_active = True
        user.set_password(password)
        user.save()

        verb = "creado" if created else "actualizado"
        self.stdout.write(self.style.SUCCESS(f"Admin '{username}' {verb}."))
