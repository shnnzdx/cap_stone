"""Shared outbound HTTP client policy for external providers."""

from __future__ import annotations

import os
from urllib.parse import urlparse

PROXY_ENV_KEYS = ("ALL_PROXY", "HTTPS_PROXY", "HTTP_PROXY")
DEAD_LOCAL_PROXY_HOSTS = frozenset({"127.0.0.1", "localhost", "::1"})
DEAD_LOCAL_PROXY_PORT = 9


def should_trust_env_proxies() -> bool:
    """Ignore obviously invalid launcher-injected discard proxies.

    Some local desktop launchers inject `127.0.0.1:9` as a process-only proxy.
    That target immediately refuses connections and breaks outbound provider
    calls even when the machine itself has direct internet access.
    """
    for key in PROXY_ENV_KEYS:
        value = (os.getenv(key) or "").strip()
        if not value:
            continue
        parsed = urlparse(value if "://" in value else f"http://{value}")
        if parsed.hostname in DEAD_LOCAL_PROXY_HOSTS and parsed.port == DEAD_LOCAL_PROXY_PORT:
            return False
    return True
