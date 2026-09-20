"""
Lightweight in-memory rate limiter for auth endpoints.

Enough for a single-instance deployment (Render free tier). For multi-instance
or horizontal scaling, swap the dict for Redis.
"""

import time
from collections import defaultdict

from fastapi import HTTPException, Request, status

from app.services.signup_guard import client_ip

# {ip: [(endpoint, timestamp), ...]}
_buckets: dict[str, list[tuple[str, float]]] = defaultdict(list)

_LIMITS: dict[str, tuple[int, int]] = {
    # endpoint prefix: (max_requests, window_seconds)
    "login": (5, 60),
    "register": (3, 300),
    "forgot-password": (3, 3600),
    "reset-password": (5, 3600),
}

_WINDOW = max(w for _, w in _LIMITS.values())


def _cleanup(ip: str, now: float) -> None:
    cutoff = now - _WINDOW
    _buckets[ip] = [(ep, ts) for ep, ts in _buckets[ip] if ts > cutoff]
    if not _buckets[ip]:
        del _buckets[ip]


def check_rate_limit(request: Request, endpoint: str, trusted_hops: int = 1) -> None:
    """Raise 429 if this IP has exceeded the limit for the given endpoint."""
    limits = _LIMITS.get(endpoint)
    if not limits:
        return

    max_requests, window = limits
    now = time.time()
    ip = client_ip(request, trusted_hops) or "unknown"

    _cleanup(ip, now)

    recent = sum(1 for ep, ts in _buckets[ip] if ep == endpoint and ts > now - window)
    if recent >= max_requests:
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            f"Too many {endpoint} attempts. Please try again later.",
        )

    _buckets[ip].append((endpoint, now))
