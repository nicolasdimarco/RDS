"""Currency conversion services."""
from __future__ import annotations

from decimal import Decimal
from typing import Optional

import logging
import requests
from django.conf import settings
from django.core.cache import cache
from django.utils import timezone

from .models import ExchangeRate

log = logging.getLogger(__name__)
CACHE_KEY = "currency:current_usd_ars"


def _from_api() -> Optional[dict]:
    try:
        resp = requests.get(settings.DOLAR_API_URL, timeout=8)
        resp.raise_for_status()
        return resp.json()
    except Exception as exc:  # noqa: BLE001
        log.warning("DolarAPI unavailable: %s", exc)
        return None


def fetch_and_store_rate(force: bool = False) -> ExchangeRate:
    """Return the latest stored rate; fetch from DolarAPI if cache expired or `force`."""
    cached = cache.get(CACHE_KEY)
    if cached and not force:
        try:
            return ExchangeRate.objects.get(pk=cached)
        except ExchangeRate.DoesNotExist:
            pass

    data = _from_api()
    if data and "venta" in data:
        rate = ExchangeRate.objects.create(
            rate=Decimal(str(data.get("venta") or data.get("compra") or 0)),
            source=ExchangeRate.SOURCE_API,
            payload=data,
            fetched_at=timezone.now(),
        )
        cache.set(CACHE_KEY, rate.id, settings.DOLAR_CACHE_SECONDS)
        return rate

    last = ExchangeRate.objects.order_by("-fetched_at").first()
    if last:
        return last
    # Last resort: a sane default so the app keeps working offline.
    return ExchangeRate.objects.create(rate=Decimal("1000.0"), source=ExchangeRate.SOURCE_MANUAL,
                                       note="default fallback")


def current_rate() -> Decimal:
    return fetch_and_store_rate().rate


def to_usd(amount, currency: str, rate: Decimal | None = None) -> Decimal:
    amount = Decimal(str(amount or 0))
    if currency == "USD":
        return amount
    rate = rate or current_rate()
    if not rate:
        return amount
    return (amount / rate).quantize(Decimal("0.01"))


def to_ars(amount, currency: str, rate: Decimal | None = None) -> Decimal:
    amount = Decimal(str(amount or 0))
    if currency == "ARS":
        return amount
    rate = rate or current_rate()
    return (amount * rate).quantize(Decimal("0.01"))
