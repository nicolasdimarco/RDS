from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from accounts.permissions import IsAdminOrReadOnly, IsAdminUserRole
from audit.utils import log_action
from .models import Purchase, Supplier
from .serializers import PurchaseSerializer, SupplierSerializer


class SupplierViewSet(viewsets.ModelViewSet):
    queryset = Supplier.objects.all().order_by("name")
    serializer_class = SupplierSerializer
    permission_classes = (IsAdminOrReadOnly,)
    search_fields = ("name", "tax_id", "contact_name", "email", "phone")

    def perform_create(self, serializer):
        instance = serializer.save(created_by=self.request.user, updated_by=self.request.user)
        log_action(self.request.user, "create", "supplier", str(instance.pk), self.request)

    def perform_update(self, serializer):
        instance = serializer.save(updated_by=self.request.user)
        log_action(self.request.user, "update", "supplier", str(instance.pk), self.request)

    def perform_destroy(self, instance):
        instance.soft_delete(user=self.request.user)
        log_action(self.request.user, "delete", "supplier", str(instance.pk), self.request)


class PurchaseViewSet(viewsets.ModelViewSet):
    queryset = Purchase.objects.select_related("supplier").prefetch_related("items").all()
    serializer_class = PurchaseSerializer
    permission_classes = (IsAuthenticated,)
    search_fields = ("invoice_number", "supplier__name", "notes")
    filterset_fields = ("supplier", "status", "currency")
    ordering_fields = ("purchase_date", "total", "total_usd", "created_at")

    def get_permissions(self):
        if self.action == "destroy":
            return [IsAdminUserRole()]
        return super().get_permissions()

    def perform_create(self, serializer):
        instance = serializer.save()
        log_action(self.request.user, "create", "purchase", str(instance.pk), self.request,
                   metadata={"total": str(instance.total), "currency": instance.currency})

    def perform_update(self, serializer):
        instance = serializer.save()
        log_action(self.request.user, "update", "purchase", str(instance.pk), self.request)

    def perform_destroy(self, instance):
        instance.soft_delete(user=self.request.user)
        log_action(self.request.user, "delete", "purchase", str(instance.pk), self.request)
