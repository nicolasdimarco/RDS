from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    """Custom user; supports admin/regular roles and group-based permissions."""

    ROLE_ADMIN = "admin"
    ROLE_USER = "user"
    ROLE_CHOICES = (
        (ROLE_ADMIN, "Administrador"),
        (ROLE_USER, "Usuario"),
    )

    email = models.EmailField(unique=True)
    role = models.CharField(max_length=16, choices=ROLE_CHOICES, default=ROLE_USER)
    phone = models.CharField(max_length=32, blank=True, default="")
    dark_mode = models.BooleanField(default=False)

    REQUIRED_FIELDS = ["email"]

    class Meta:
        ordering = ("username",)

    @property
    def is_admin(self) -> bool:
        return self.role == self.ROLE_ADMIN or self.is_superuser

    def __str__(self) -> str:
        return self.username
