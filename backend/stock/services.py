"""Stock service: applies movements & keeps `Product.stock_qty` and average cost in sync."""
from __future__ import annotations

from decimal import Decimal

from django.db import transaction
from django.db.models import F

from currency.services import to_usd
from products.models import PriceHistory, Product

from .models import StockMovement


@transaction.atomic
def register_movement(*, product: Product, kind: str, quantity: int,
                      unit_cost: Decimal | float | int = 0, currency: str = "USD",
                      rate_used: Decimal | None = None, note: str = "",
                      purchase=None, project_item=None, user=None) -> StockMovement:
    """Persist a movement, refresh cached stock_qty, and (for inflows) the average/last cost."""
    if quantity == 0:
        raise ValueError("La cantidad del movimiento no puede ser 0.")

    movement = StockMovement.objects.create(
        product=product,
        kind=kind,
        quantity=int(quantity),
        unit_cost=Decimal(str(unit_cost or 0)),
        currency=currency,
        rate_used=rate_used,
        note=note,
        purchase=purchase,
        project_item=project_item,
        created_by=user,
    )

    Product.objects.filter(pk=product.pk).update(stock_qty=F("stock_qty") + movement.quantity)

    # Update cost on inflow movements (purchase/initial/return_in).
    if movement.quantity > 0 and kind in (
        StockMovement.KIND_PURCHASE, StockMovement.KIND_INITIAL, StockMovement.KIND_RETURN_IN,
    ):
        product.refresh_from_db()
        new_cost_usd = to_usd(movement.unit_cost, currency, rate_used)
        prev_cost_usd = to_usd(product.average_cost, product.cost_currency)
        prev_qty_in = max(product.stock_qty - movement.quantity, 0)
        if prev_qty_in <= 0:
            avg_usd = new_cost_usd
        else:
            avg_usd = ((prev_cost_usd * prev_qty_in) + (new_cost_usd * movement.quantity)) / (
                prev_qty_in + movement.quantity
            )
        Product.objects.filter(pk=product.pk).update(
            last_cost=movement.unit_cost,
            cost_currency=currency,
            average_cost=avg_usd.quantize(Decimal("0.01")),
        )
        PriceHistory.objects.create(
            product=product,
            cost=movement.unit_cost,
            currency=currency,
            rate_used=rate_used,
            note=f"auto:{kind}",
            created_by=user,
        )

    return movement
