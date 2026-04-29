from rest_framework import serializers

from .models import ExchangeRate


class ExchangeRateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExchangeRate
        fields = ("id", "rate", "source", "note", "fetched_at", "payload")
        read_only_fields = ("id", "fetched_at", "payload")
