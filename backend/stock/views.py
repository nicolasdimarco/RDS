from django.db.models import F, Q
from rest_framework import mixins, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsAdminOrReadOnly
from products.models import Product
from products.serializers import ProductSerializer

from .models import StockMovement
from .serializers import StockMovementSerializer


class StockMovementViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin,
                           mixins.CreateModelMixin, viewsets.GenericViewSet):
    queryset = (
        StockMovement.objects.select_related("product")
        .filter(Q(project_item__isnull=True) | Q(project_item__project__deleted_at__isnull=True))
    )
    serializer_class = StockMovementSerializer
    permission_classes = (IsAdminOrReadOnly,)
    filterset_fields = ("product", "kind", "purchase", "project_item")
    search_fields = ("product__sku", "product__name", "note")
    ordering_fields = ("created_at", "quantity")


class StockSummaryView(APIView):
    permission_classes = (IsAuthenticated,)

    def get(self, request):
        qs = Product.objects.all()
        return Response({
            "total_products": qs.count(),
            "total_units": sum(qs.values_list("stock_qty", flat=True)),
            "low_stock": qs.filter(stock_qty__lte=F("min_stock")).count(),
            "out_of_stock": qs.filter(stock_qty__lte=0).count(),
        })


class LowStockView(APIView):
    permission_classes = (IsAuthenticated,)

    def get(self, request):
        qs = Product.objects.filter(stock_qty__lte=F("min_stock")).order_by("stock_qty")[:50]
        return Response(ProductSerializer(qs, many=True).data)
