from decimal import Decimal
from unittest.mock import patch

import pytest

from projects.models import Project
from stock.models import StockMovement


@pytest.fixture(autouse=True)
def _stub_currency():
    with patch("currency.services._from_api", return_value={"venta": 1000, "compra": 990}):
        yield


@pytest.mark.django_db
def test_project_totals_and_margin(auth_client, client_obj, product):
    payload = {
        "client": client_obj.id,
        "status": "approved",
        "currency": "USD",
        "rate_used": "1000",
        "discount_pct": "0",
        "extra_charges": "0",
        "items": [
            {"product": product.id, "quantity": 3, "unit_price": "200", "unit_cost": "100",
             "discount_pct": "0", "iva_pct": "0"}
        ],
    }
    resp = auth_client.post("/api/v1/projects/", payload, format="json")
    assert resp.status_code == 201, resp.content
    body = resp.json()
    assert body["name"] == f"#{body['id']} - {client_obj.name}"
    assert Decimal(body["subtotal"]) == Decimal("600.00")
    assert Decimal(body["total"]) == Decimal("600.00")
    assert Decimal(body["cost_total"]) == Decimal("300.00")
    assert Decimal(body["profit_usd"]) == Decimal("300.00")
    assert Decimal(body["margin_pct"]) == Decimal("50.00")
    # Not completed yet => no stock movement, stock not committed
    assert body["stock_committed"] is False
    assert StockMovement.objects.filter(kind=StockMovement.KIND_SALE).count() == 0


@pytest.mark.django_db
def test_completing_project_decrements_stock(auth_client, client_obj, product):
    # Create approved
    resp = auth_client.post("/api/v1/projects/", {
        "client": client_obj.id, "status": "approved",
        "currency": "USD", "rate_used": "1000",
        "items": [{"product": product.id, "quantity": 2, "unit_price": "200",
                   "unit_cost": "100", "discount_pct": "0"}],
    }, format="json")
    pid = resp.json()["id"]
    # Move to completed
    upd = auth_client.patch(f"/api/v1/projects/{pid}/", {"status": "completed"}, format="json")
    assert upd.status_code == 200, upd.content
    body = upd.json()
    assert body["stock_committed"] is True
    product.refresh_from_db()
    assert product.stock_qty == -2  # negative allowed
    assert StockMovement.objects.filter(kind=StockMovement.KIND_SALE,
                                        project_item__project_id=pid).count() == 1


@pytest.mark.django_db
def test_dashboard_aggregates(auth_client, client_obj, product):
    auth_client.post("/api/v1/projects/", {
        "client": client_obj.id, "status": "approved",
        "currency": "USD", "rate_used": "1000",
        "items": [{"product": product.id, "quantity": 1, "unit_price": "500",
                   "unit_cost": "200", "discount_pct": "0", "iva_pct": "0"}],
    }, format="json")
    resp = auth_client.get("/api/v1/dashboard/")
    assert resp.status_code == 200
    data = resp.json()
    assert data["totals"]["sold_usd"] == 500.0
    assert data["totals"]["cost_usd"] == 200.0
    assert data["totals"]["profit_usd"] == 300.0
