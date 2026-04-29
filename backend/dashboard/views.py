from datetime import date, timedelta
from decimal import Decimal

from django.db.models import Count, F, Sum
from django.db.models.functions import TruncMonth
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from products.models import Product
from projects.models import Project, ProjectPayment
from purchases.models import Purchase
from stock.models import StockMovement


def _serialize(qs, key="month"):
    return [
        {
            key: row[key].strftime("%Y-%m") if row.get(key) else None,
            **{k: float(v or 0) for k, v in row.items() if k != key},
        }
        for row in qs
    ]


class DashboardView(APIView):
    permission_classes = (IsAuthenticated,)

    def get(self, request):
        months_back = int(request.query_params.get("months", 12))
        since = (date.today().replace(day=1) - timedelta(days=31 * (months_back - 1))).replace(day=1)

        # Project status counts
        status_counts = list(
            Project.objects.values("status").annotate(count=Count("id")).order_by("status")
        )

        # Totals (USD) — projects considered "sold" when not cancelled
        proj_qs = Project.objects.exclude(status=Project.STATUS_CANCELLED)
        sold_total_usd = proj_qs.aggregate(s=Sum("total_usd"))["s"] or Decimal("0")
        cost_total_usd = proj_qs.aggregate(s=Sum("cost_total_usd"))["s"] or Decimal("0")
        profit_total_usd = (sold_total_usd or 0) - (cost_total_usd or 0)
        margin = float(profit_total_usd / sold_total_usd * 100) if sold_total_usd else 0.0

        # Cash collected (USD) for non-cancelled projects, and outstanding balance
        collected_total_usd = (
            ProjectPayment.objects.exclude(project__status=Project.STATUS_CANCELLED)
            .aggregate(s=Sum("amount_usd"))["s"]
            or Decimal("0")
        )
        receivable_total_usd = (sold_total_usd or Decimal("0")) - collected_total_usd
        if receivable_total_usd < 0:
            receivable_total_usd = Decimal("0")

        # Purchases totals
        purchases_total_usd = Purchase.objects.exclude(
            status=Purchase.STATUS_CANCELLED
        ).aggregate(s=Sum("total_usd"))["s"] or Decimal("0")

        # Monthly series
        monthly_sales = (
            proj_qs.filter(created_at__date__gte=since)
            .annotate(month=TruncMonth("created_at"))
            .values("month")
            .annotate(total=Sum("total_usd"), profit=Sum("profit_usd"), count=Count("id"))
            .order_by("month")
        )
        monthly_purchases = (
            Purchase.objects.exclude(status=Purchase.STATUS_CANCELLED)
            .filter(purchase_date__gte=since)
            .annotate(month=TruncMonth("purchase_date"))
            .values("month")
            .annotate(total=Sum("total_usd"), count=Count("id"))
            .order_by("month")
        )

        # Stock health
        stock_summary = {
            "products": Product.objects.count(),
            "units": Product.objects.aggregate(s=Sum("stock_qty"))["s"] or 0,
            "low_stock": Product.objects.filter(stock_qty__lte=F("min_stock")).count(),
            "out_of_stock": Product.objects.filter(stock_qty__lte=0).count(),
        }

        # Top products by quantity sold
        top_products = list(
            StockMovement.objects.filter(kind=StockMovement.KIND_SALE)
            .values("product__sku", "product__name")
            .annotate(qty=Sum("quantity"))
            .order_by("qty")[:10]
        )

        # Top clients by USD sold
        top_clients = list(
            proj_qs.values("client__name")
            .annotate(total=Sum("total_usd"))
            .order_by("-total")[:10]
        )

        return Response({
            "totals": {
                "sold_usd": float(sold_total_usd),
                "cost_usd": float(cost_total_usd),
                "profit_usd": float(profit_total_usd),
                "margin_pct": round(margin, 2),
                "purchases_usd": float(purchases_total_usd),
                "collected_usd": float(collected_total_usd),
                "receivable_usd": float(receivable_total_usd),
            },
            "status_counts": status_counts,
            "stock": stock_summary,
            "monthly_sales": _serialize(monthly_sales),
            "monthly_purchases": _serialize(monthly_purchases),
            "top_products": [
                {"sku": r["product__sku"], "name": r["product__name"], "qty": int(-r["qty"] or 0)}
                for r in top_products
            ],
            "top_clients": [
                {"name": r["client__name"], "total_usd": float(r["total"] or 0)}
                for r in top_clients
            ],
        })
