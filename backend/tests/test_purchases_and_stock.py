from decimal import Decimal
from unittest.mock import patch

import pytest

from products.models import Product
from purchases.models import Purchase
from stock.models import StockMovement


@pytest.fixture(autouse=True)
def _stub_currency():
    """Force a deterministic FX rate during tests."""
    with patch("currency.services._from_api", return_value={"venta": 1000, "compra": 990}):
        yield


@pytest.mark.django_db
def test_purchase_received_creates_stock_movement_and_updates_avg_cost(auth_client, supplier, product):
    payload = {
        "supplier": supplier.id,
        "purchase_date": "2026-01-15",
        "currency": "USD",
        "status": "received",
        "extra_costs": "0",
        "items": [
            {"product": product.id, "quantity": 5, "unit_cost": "120.00", "discount_pct": "0"}
        ],
    }
    resp = auth_client.post("/api/v1/purchases/", payload, format="json")
    assert resp.status_code == 201, resp.content
    purchase_id = resp.json()["id"]

    # Stock cached value updated
    product.refresh_from_db()
    assert product.stock_qty == 5
    assert product.last_cost == Decimal("120.00")
    # Average: prev qty=0 so equals new cost
    assert product.average_cost == Decimal("120.00")

    # A stock movement exists for the purchase
    mvs = StockMovement.objects.filter(purchase_id=purchase_id)
    assert mvs.count() == 1
    assert mvs.first().quantity == 5
    assert mvs.first().kind == StockMovement.KIND_PURCHASE


@pytest.mark.django_db
def test_purchase_total_in_usd(auth_client, supplier, product):
    payload = {
        "supplier": supplier.id, "purchase_date": "2026-01-15", "currency": "ARS",
        "rate_used": "1000", "status": "draft",
        "items": [{"product": product.id, "quantity": 2, "unit_cost": "10000", "discount_pct": "0"}],
    }
    resp = auth_client.post("/api/v1/purchases/", payload, format="json")
    assert resp.status_code == 201, resp.content
    body = resp.json()
    assert Decimal(body["total"]) == Decimal("20000.00")
    assert Decimal(body["total_usd"]) == Decimal("20.00")


@pytest.mark.django_db
def test_stock_can_go_negative(auth_client, product):
    """Selling more than available is allowed (business rule)."""
    payload = {"product": product.id, "kind": "sale", "quantity": -3, "unit_cost": "0",
               "currency": "USD"}
    resp = auth_client.post("/api/v1/stock-movements/", payload, format="json")
    assert resp.status_code == 201, resp.content
    product.refresh_from_db()
    assert product.stock_qty == -3


@pytest.mark.django_db
def test_average_cost_weighted(auth_client, supplier, product):
    # First purchase: 4 @ 100 USD
    auth_client.post("/api/v1/purchases/", {
        "supplier": supplier.id, "purchase_date": "2026-01-01", "currency": "USD",
        "status": "received",
        "items": [{"product": product.id, "quantity": 4, "unit_cost": "100", "discount_pct": "0"}],
    }, format="json")
    # Second purchase: 6 @ 200 USD => avg = (4*100 + 6*200)/10 = 160
    auth_client.post("/api/v1/purchases/", {
        "supplier": supplier.id, "purchase_date": "2026-01-02", "currency": "USD",
        "status": "received",
        "items": [{"product": product.id, "quantity": 6, "unit_cost": "200", "discount_pct": "0"}],
    }, format="json")
    product.refresh_from_db()
    assert product.stock_qty == 10
    assert product.average_cost == Decimal("160.00")


@pytest.mark.django_db
def test_suggested_price_uses_margin(product):
    product.average_cost = Decimal("100")
    product.suggested_margin_pct = Decimal("30")
    product.save()
    assert product.suggested_price == Decimal("130.00")
