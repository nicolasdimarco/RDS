from rest_framework import viewsets
from rest_framework.parsers import FormParser, MultiPartParser

from accounts.permissions import IsAdminOrReadOnly
from .models import Attachment
from .serializers import AttachmentSerializer


class AttachmentViewSet(viewsets.ModelViewSet):
    queryset = Attachment.objects.all().order_by("-uploaded_at")
    serializer_class = AttachmentSerializer
    permission_classes = (IsAdminOrReadOnly,)
    parser_classes = (MultiPartParser, FormParser)
    filterset_fields = ("entity", "entity_id")

    def perform_create(self, serializer):
        upload = serializer.validated_data.get("file")
        serializer.save(
            uploaded_by=self.request.user,
            content_type=getattr(upload, "content_type", "") or "",
        )
