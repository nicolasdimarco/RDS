from __future__ import annotations

from typing import Any, Mapping

from .models import AuditLog


def _client_ip(request) -> str | None:
    if request is None:
        return None
    xff = request.META.get("HTTP_X_FORWARDED_FOR")
    if xff:
        return xff.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


def log_action(user, action: str, entity: str, entity_id: str = "", request=None,
               metadata: Mapping[str, Any] | None = None) -> AuditLog:
    return AuditLog.objects.create(
        user=user if (user and getattr(user, "is_authenticated", False)) else None,
        action=action,
        entity=entity,
        entity_id=str(entity_id) if entity_id else "",
        ip=_client_ip(request),
        metadata=dict(metadata or {}),
    )
