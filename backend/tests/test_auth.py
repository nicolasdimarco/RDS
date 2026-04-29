import pytest
from django.contrib.auth import get_user_model


@pytest.mark.django_db
def test_login_returns_tokens_and_user(api_client):
    User = get_user_model()
    User.objects.create_user(username="u", email="u@x.com", password="pass1234", role="admin",
                             is_staff=True, is_superuser=True)
    resp = api_client.post(
        "/api/v1/auth/login/", {"username": "u", "password": "pass1234"}, format="json"
    )
    assert resp.status_code == 200, resp.content
    data = resp.json()
    assert "access" in data and "refresh" in data
    assert data["user"]["username"] == "u"
    assert data["user"]["role"] == "admin"


@pytest.mark.django_db
def test_login_wrong_password(api_client):
    User = get_user_model()
    User.objects.create_user(username="u2", email="u2@x.com", password="pass1234")
    resp = api_client.post(
        "/api/v1/auth/login/", {"username": "u2", "password": "WRONG"}, format="json"
    )
    assert resp.status_code == 401


@pytest.mark.django_db
def test_me_endpoint_requires_auth(api_client, admin_user):
    resp = api_client.get("/api/v1/auth/me/")
    assert resp.status_code == 401
    api_client.force_authenticate(user=admin_user)
    resp = api_client.get("/api/v1/auth/me/")
    assert resp.status_code == 200
    assert resp.json()["username"] == admin_user.username
