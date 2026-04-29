"""Seed initial admin user and a few catalog rows for development."""
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from products.models import Brand, Category, Product
from purchases.models import Supplier
from projects.models import Client


class Command(BaseCommand):
    help = "Crea usuario admin y datos demo."

    def add_arguments(self, parser):
        parser.add_argument("--admin-username", default="admin")
        parser.add_argument("--admin-password", default="admin1234")
        parser.add_argument("--admin-email", default="admin@rds.local")

    def handle(self, *args, **options):
        User = get_user_model()
        admin, created = User.objects.get_or_create(
            username=options["admin_username"],
            defaults={
                "email": options["admin_email"],
                "first_name": "Admin",
                "last_name": "RDS",
                "role": User.ROLE_ADMIN,
                "is_staff": True,
                "is_superuser": True,
            },
        )
        admin.set_password(options["admin_password"])
        admin.is_staff = True
        admin.is_superuser = True
        admin.role = User.ROLE_ADMIN
        admin.save()
        self.stdout.write(self.style.SUCCESS(
            f"Admin {'creado' if created else 'actualizado'}: "
            f"{options['admin_username']} / {options['admin_password']}"
        ))

        cat_panel, _ = Category.objects.get_or_create(name="Paneles solares")
        cat_inv, _ = Category.objects.get_or_create(name="Inversores")
        cat_bat, _ = Category.objects.get_or_create(name="Baterías")
        brand_x, _ = Brand.objects.get_or_create(name="SunMax")
        brand_y, _ = Brand.objects.get_or_create(name="GreenPower")

        Product.objects.get_or_create(
            sku="PNL-450W",
            defaults=dict(
                name="Panel solar 450W monocristalino",
                category=cat_panel, brand=brand_x, unit="unidad",
                min_stock=5, cost_currency="USD",
                cost=Decimal("120.00"),
                last_cost=Decimal("120.00"), average_cost=Decimal("120.00"),
                sale_price=Decimal("180.00"), sale_currency="USD",
                suggested_margin_pct=Decimal("35"),
            ),
        )
        Product.objects.get_or_create(
            sku="INV-5KW",
            defaults=dict(
                name="Inversor híbrido 5kW",
                category=cat_inv, brand=brand_y, unit="unidad",
                min_stock=2, cost_currency="USD",
                cost=Decimal("850.00"),
                last_cost=Decimal("850.00"), average_cost=Decimal("850.00"),
                sale_price=Decimal("1200.00"), sale_currency="USD",
            ),
        )
        Product.objects.get_or_create(
            sku="BAT-100AH",
            defaults=dict(
                name="Batería litio 100Ah 12V",
                category=cat_bat, brand=brand_y, unit="unidad",
                min_stock=3, cost_currency="USD",
                cost=Decimal("400.00"),
                last_cost=Decimal("400.00"), average_cost=Decimal("400.00"),
                sale_price=Decimal("620.00"), sale_currency="USD",
            ),
        )

        Supplier.objects.get_or_create(
            name="Importadora Solar SA",
            defaults={"contact_name": "Carlos", "email": "ventas@isolar.com"},
        )
        Client.objects.get_or_create(
            name="EcoCampo SRL",
            defaults={"email": "compras@ecocampo.com"},
        )
        self.stdout.write(self.style.SUCCESS("Datos demo cargados."))
