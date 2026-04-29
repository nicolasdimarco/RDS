"""URL configuration for the RDS backend."""
from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from accounts.views import (
    LoginView, LogoutView, MeView, PasswordResetRequestView,
    PasswordResetConfirmView, UserViewSet, GroupViewSet,
)
from audit.views import AuditLogViewSet
from currency.views import CurrentRateView, ExchangeRateViewSet
from dashboard.views import DashboardView
from files.views import AttachmentViewSet
from products.views import BrandViewSet, CategoryViewSet, ProductViewSet, PriceHistoryViewSet
from projects.views import ClientViewSet, ProjectViewSet, ProjectItemViewSet
from purchases.views import PurchaseViewSet, SupplierViewSet
from stock.views import StockMovementViewSet, StockSummaryView, LowStockView
from rest_framework_simplejwt.views import TokenRefreshView

router = DefaultRouter()
router.register(r"users", UserViewSet, basename="user")
router.register(r"groups", GroupViewSet, basename="group")
router.register(r"audit", AuditLogViewSet, basename="audit")
router.register(r"exchange-rates", ExchangeRateViewSet, basename="exchange-rate")
router.register(r"categories", CategoryViewSet, basename="category")
router.register(r"brands", BrandViewSet, basename="brand")
router.register(r"products", ProductViewSet, basename="product")
router.register(r"price-history", PriceHistoryViewSet, basename="price-history")
router.register(r"suppliers", SupplierViewSet, basename="supplier")
router.register(r"purchases", PurchaseViewSet, basename="purchase")
router.register(r"clients", ClientViewSet, basename="client")
router.register(r"projects", ProjectViewSet, basename="project")
router.register(r"project-items", ProjectItemViewSet, basename="project-item")
router.register(r"stock-movements", StockMovementViewSet, basename="stock-movement")
router.register(r"attachments", AttachmentViewSet, basename="attachment")

api_v1 = [
    path("auth/login/", LoginView.as_view(), name="login"),
    path("auth/logout/", LogoutView.as_view(), name="logout"),
    path("auth/refresh/", TokenRefreshView.as_view(), name="refresh"),
    path("auth/me/", MeView.as_view(), name="me"),
    path("auth/password-reset/", PasswordResetRequestView.as_view(), name="password-reset"),
    path("auth/password-reset/confirm/", PasswordResetConfirmView.as_view(), name="password-reset-confirm"),
    path("currency/current/", CurrentRateView.as_view(), name="currency-current"),
    path("dashboard/", DashboardView.as_view(), name="dashboard"),
    path("stock/summary/", StockSummaryView.as_view(), name="stock-summary"),
    path("stock/low/", LowStockView.as_view(), name="stock-low"),
    path("", include(router.urls)),
]

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/v1/", include((api_v1, "api"), namespace="v1")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
