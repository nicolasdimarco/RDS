from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from accounts.permissions import IsAdminOrReadOnly, IsAdminUserRole
from audit.utils import log_action
from .models import Client, Project, ProjectItem, ProjectPayment
from .serializers import (
    ClientSerializer, ProjectItemSerializer, ProjectPaymentSerializer,
    ProjectSerializer,
)


class ClientViewSet(viewsets.ModelViewSet):
    queryset = Client.objects.all().order_by("name")
    serializer_class = ClientSerializer
    permission_classes = (IsAdminOrReadOnly,)
    search_fields = ("name", "tax_id", "email", "phone")

    def perform_create(self, serializer):
        instance = serializer.save(created_by=self.request.user, updated_by=self.request.user)
        log_action(self.request.user, "create", "client", str(instance.pk), self.request)

    def perform_update(self, serializer):
        instance = serializer.save(updated_by=self.request.user)
        log_action(self.request.user, "update", "client", str(instance.pk), self.request)

    def perform_destroy(self, instance):
        instance.soft_delete(user=self.request.user)
        log_action(self.request.user, "delete", "client", str(instance.pk), self.request)


class ProjectViewSet(viewsets.ModelViewSet):
    queryset = (
        Project.objects.select_related("client")
        .prefetch_related("items", "payments")
        .all()
    )
    serializer_class = ProjectSerializer
    permission_classes = (IsAuthenticated,)
    search_fields = ("name", "client__name", "notes")
    filterset_fields = ("status", "client", "currency", "stock_committed")
    ordering_fields = ("created_at", "date", "total_usd", "profit_usd", "margin_pct")

    def get_permissions(self):
        if self.action == "destroy":
            return [IsAdminUserRole()]
        return super().get_permissions()

    def perform_create(self, serializer):
        instance = serializer.save()
        log_action(self.request.user, "create", "project", str(instance.pk), self.request,
                   metadata={"status": instance.status})

    def perform_update(self, serializer):
        instance = serializer.save()
        log_action(self.request.user, "update", "project", str(instance.pk), self.request,
                   metadata={"status": instance.status})

    def perform_destroy(self, instance):
        instance.soft_delete(user=self.request.user)
        log_action(self.request.user, "delete", "project", str(instance.pk), self.request)


class ProjectItemViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = ProjectItem.objects.select_related("project", "product").all()
    serializer_class = ProjectItemSerializer
    filterset_fields = ("project", "product")


class ProjectPaymentViewSet(viewsets.ModelViewSet):
    queryset = ProjectPayment.objects.select_related("project").all()
    serializer_class = ProjectPaymentSerializer
    permission_classes = (IsAuthenticated,)
    filterset_fields = ("project", "method", "currency")
    ordering_fields = ("date", "created_at")

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [IsAdminUserRole()]
        return super().get_permissions()

    def perform_create(self, serializer):
        instance = serializer.save()
        log_action(self.request.user, "create", "project_payment", str(instance.pk), self.request,
                   metadata={"project": instance.project_id, "amount_usd": str(instance.amount_usd)})

    def perform_update(self, serializer):
        instance = serializer.save()
        log_action(self.request.user, "update", "project_payment", str(instance.pk), self.request)

    def perform_destroy(self, instance):
        log_action(self.request.user, "delete", "project_payment", str(instance.pk), self.request,
                   metadata={"project": instance.project_id})
        instance.delete()
