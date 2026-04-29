from decimal import Decimal
import os
import sys

import pytest
from django.contrib.auth import get_user_model

# ensure the backend package root is importable
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))


@pytest.fixture
def admin_user(db):
    User = get_user_model()
    user = User.objects.create_user(
        username="admin", email="a@a.com", password="x", role="admin",
        is_staff=True, is_superuser=True,
    )
    return user


@pytest.fixture
def regular_user(db):
    User = get_user_model()
    return User.objects.create_user(username="bob", email="b@b.com", password="x")


@pytest.fixture
def api_client():
    from rest_framework.test import APIClient
    return APIClient()


@pytest.fixture
def auth_client(api_client, admin_user):
    api_client.force_authenticate(user=admin_user)
    return api_client


@pytest.fixture
def category(db):
    from products.models import Category
    return Category.objects.create(name="Paneles")


@pytest.fixture
def product(category):
    from products.models import Product
    return Product.objects.create(
        sku="PNL-1", name="Panel 100W", category=category,
        cost=Decimal("100"),
        last_cost=Decimal("100"), average_cost=Decimal("100"),
        sale_price=Decimal("150"), cost_currency="USD", sale_currency="USD",
        min_stock=2, suggested_margin_pct=Decimal("30"),
    )


@pytest.fixture
def supplier(db):
    from purchases.models import Supplier
    return Supplier.objects.create(name="Prov SA")


@pytest.fixture
def client_obj(db):
    from projects.models import Client
    return Client.objects.create(name="Cliente SA")
