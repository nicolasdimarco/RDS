from decimal import Decimal
from unittest.mock import patch

import pytest

from currency.models import ExchangeRate
from currency.services import fetch_and_store_rate, to_ars, to_usd


@pytest.mark.django_db
def test_fetch_and_store_rate_uses_api():
    with patch("currency.services._from_api", return_value={"venta": 1500, "compra": 1490}):
        rate = fetch_and_store_rate(force=True)
    assert rate.rate == Decimal("1500")
    assert rate.source == ExchangeRate.SOURCE_API


@pytest.mark.django_db
def test_fetch_falls_back_to_last_persisted():
    ExchangeRate.objects.create(rate=Decimal("1234.5"), source=ExchangeRate.SOURCE_MANUAL)
    with patch("currency.services._from_api", return_value=None):
        rate = fetch_and_store_rate(force=True)
    assert rate.rate == Decimal("1234.5")


@pytest.mark.django_db
def test_to_usd_and_to_ars():
    assert to_usd(1000, "ARS", Decimal("1000")) == Decimal("1.00")
    assert to_usd(50, "USD") == Decimal("50")
    assert to_ars(2, "USD", Decimal("1500")) == Decimal("3000.00")
    assert to_ars(500, "ARS") == Decimal("500")
