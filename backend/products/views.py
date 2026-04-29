from rest_framework import viewsets

from accounts.permissions import IsAdminOrReadOnly
from audit.utils import log_action
from .models import Brand, Category, PriceHistory, Product
from .serializers import (
    BrandSerializer, CategorySerializer, PriceHistorySerializer, ProductSerializer,
)


class _Audited(viewsets.ModelViewSet):
    audit_entity = "object"

    def perform_create(self, serializer):
        instance = serializer.save(created_by=self.request.user, updated_by=self.request.user)
        log_action(self.request.user, "create", self.audit_entity, str(instance.pk), self.request)

    def perform_update(self, serializer):
        instance = serializer.save(updated_by=self.request.user)
        log_action(self.request.user, "update", self.audit_entity, str(instance.pk), self.request)

    def perform_destroy(self, instance):
        if hasattr(instance, "soft_delete"):
            instance.soft_delete(user=self.request.user)
        else:
            instance.delete()
        log_action(self.request.user, "delete", self.audit_entity, str(instance.pk), self.request)


class CategoryViewSet(_Audited):
    queryset = Category.objects.all().order_by("name")
    serializer_class = CategorySerializer
    permission_classes = (IsAdminOrReadOnly,)
    search_fields = ("name", "description")
    audit_entity = "category"


class BrandViewSet(_Audited):
    queryset = Brand.objects.all().order_by("name")
    serializer_class = BrandSerializer
    permission_classes = (IsAdminOrReadOnly,)
    search_fields = ("name",)
    audit_entity = "brand"


class ProductViewSet(_Audited):
    queryset = Product.objects.select_related("category", "brand").all().order_by("name")
    serializer_class = ProductSerializer
    permission_classes = (IsAdminOrReadOnly,)
    search_fields = ("sku", "name", "description", "category__name", "brand__name")
    filterset_fields = ("category", "brand", "is_active", "cost_currency", "sale_currency")
    ordering_fields = ("name", "sku", "stock_qty", "cost", "last_cost", "average_cost", "sale_price")
    audit_entity = "product"


class PriceHistoryViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = PriceHistory.objects.select_related("product").all()
    serializer_class = PriceHistorySerializer
    filterset_fields = ("product",)
    ordering_fields = ("created_at",)
