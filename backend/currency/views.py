from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsAdminOrReadOnly
from .models import ExchangeRate
from .serializers import ExchangeRateSerializer
from .services import fetch_and_store_rate


class CurrentRateView(APIView):
    permission_classes = (IsAuthenticated,)

    def get(self, request):
        force = request.query_params.get("refresh") in ("1", "true", "yes")
        rate = fetch_and_store_rate(force=force)
        return Response(ExchangeRateSerializer(rate).data)


class ExchangeRateViewSet(viewsets.ModelViewSet):
    queryset = ExchangeRate.objects.all().order_by("-fetched_at")
    serializer_class = ExchangeRateSerializer
    permission_classes = (IsAdminOrReadOnly,)
    filterset_fields = ("source",)
    ordering_fields = ("fetched_at", "rate")
