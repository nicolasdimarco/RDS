from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.contrib.auth.tokens import default_token_generator
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from rest_framework import status, viewsets
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView

from audit.utils import log_action
from .permissions import IsAdminUserRole
from .serializers import (
    GroupSerializer, LoginSerializer, PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer, UserSerializer,
)

User = get_user_model()


class LoginView(TokenObtainPairView):
    permission_classes = (AllowAny,)
    serializer_class = LoginSerializer

    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        if response.status_code == 200:
            try:
                user = User.objects.get(username=request.data.get("username"))
                log_action(user, "login", "auth", str(user.id), request)
            except User.DoesNotExist:
                pass
        return response


class LogoutView(APIView):
    permission_classes = (IsAuthenticated,)

    def post(self, request):
        log_action(request.user, "logout", "auth", str(request.user.id), request)
        return Response(status=status.HTTP_204_NO_CONTENT)


class MeView(APIView):
    permission_classes = (IsAuthenticated,)

    def get(self, request):
        return Response(UserSerializer(request.user).data)

    def patch(self, request):
        serializer = UserSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        allowed = {"first_name", "last_name", "email", "phone", "dark_mode", "password"}
        forbidden = set(serializer.validated_data) - allowed
        if forbidden and not request.user.is_admin:
            return Response({"detail": f"No autorizado: {sorted(forbidden)}"}, status=403)
        serializer.save()
        return Response(serializer.data)


class PasswordResetRequestView(APIView):
    permission_classes = (AllowAny,)

    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"]
        user = User.objects.filter(email__iexact=email, is_active=True).first()
        token = uid = None
        if user:
            token = default_token_generator.make_token(user)
            uid = urlsafe_base64_encode(force_bytes(user.pk))
        from django.conf import settings as dj_settings
        body = {"detail": "Si el email existe, se enviarán instrucciones."}
        if dj_settings.DEBUG and user:
            body.update({"debug_token": token, "debug_uid": uid})
        return Response(body)


class PasswordResetConfirmView(APIView):
    permission_classes = (AllowAny,)

    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            uid = force_str(urlsafe_base64_decode(serializer.validated_data["uid"]))
            user = User.objects.get(pk=uid)
        except (User.DoesNotExist, ValueError, TypeError):
            return Response({"detail": "Token inválido."}, status=400)
        if not default_token_generator.check_token(user, serializer.validated_data["token"]):
            return Response({"detail": "Token inválido o expirado."}, status=400)
        user.set_password(serializer.validated_data["new_password"])
        user.save()
        log_action(user, "password_reset", "auth", str(user.id), request)
        return Response({"detail": "Contraseña actualizada."})


class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all().order_by("username")
    serializer_class = UserSerializer
    permission_classes = (IsAdminUserRole,)
    search_fields = ("username", "email", "first_name", "last_name")
    filterset_fields = ("role", "is_active")

    def perform_destroy(self, instance):
        instance.is_active = False
        instance.save(update_fields=["is_active"])
        log_action(self.request.user, "deactivate", "user", str(instance.id), self.request)


class GroupViewSet(viewsets.ModelViewSet):
    queryset = Group.objects.all().order_by("name")
    serializer_class = GroupSerializer
    permission_classes = (IsAdminUserRole,)
