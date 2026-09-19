"""
Rate-limiting account creation per origin, to make usage farming expensive.

The free plan includes a weekly allowance, so the cheapest attack on it is to
make more accounts. This does not try to make that impossible - it cannot be.
It tries to make it tedious enough not to be worth doing.

Three decisions shape this, and each is a trade against blocking real people.

**A limit, not a block.** One IP is not one person. An agency with five
designers in an office shares an address, so does a coworking space, and every
mobile carrier puts thousands of customers behind one through CGNAT. A blanket
"one account per IP" would reject the Agency tier's own customers while
costing a farmer one tap to switch to mobile data.

**IPv6 is counted by /64, not by address.** A residential IPv6 customer is
handed a whole /64 and can use a different address for every request. Counting
exact addresses would leave the limit trivially bypassed by anyone on modern
networking, which is not the person it is aimed at.

**The address is stored hashed, never in the clear.** Counting needs only
equality, which a hash gives. An IP address is personal data and a home
address by proxy, so there is no reason for this database to hold a readable
one. The hash is keyed with the application secret, so the table cannot be
reversed with a rainbow table of the whole IPv4 space.
"""

import hashlib
import ipaddress
import logging
from datetime import datetime, timedelta, timezone

from fastapi import Request
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.models.workspace import User

logger = logging.getLogger("leadforge.signup")


class TooManyAccounts(Exception):
    """Raised when one origin has created more accounts than the limit allows."""

    def __init__(self, limit: int, window_hours: int):
        self.limit = limit
        self.window_hours = window_hours
        super().__init__(f"{limit} accounts per {window_hours}h from one origin")

    def describe_limit(self) -> str:
        return "Only one account" if self.limit == 1 else f"Only {self.limit} accounts"

    def describe_window(self) -> str:
        """The window in words, or nothing at all when there is no window."""
        if not self.window_hours:
            return ""
        days = self.window_hours // 24
        if days >= 2:
            return f" every {days} days"
        return f" every {self.window_hours} hours"


def client_ip(request: Request, trusted_hops: int = 1) -> str | None:
    """The caller's address, as well as it can be known behind a proxy.

    Render terminates TLS and proxies to the app, so request.client.host is
    the proxy and useless here. The address comes from X-Forwarded-For - but
    which entry matters, and the obvious choice is the wrong one.

    The LEFTMOST entry is the usual answer and is forgeable: a caller can send
    their own X-Forwarded-For, and a proxy that appends will leave that
    invented value at the front. Anyone who knew would bypass this by typing
    one header, which is precisely the person it is meant to stop.

    So this counts from the RIGHT instead. Each trusted proxy appends the peer
    it actually saw, so with one proxy in front the last entry is the address
    Render observed, and nothing the caller sends can move it. A proxy that
    replaces the header rather than appending gives the same answer, because
    then there is only one entry.

    `trusted_hops` is how many proxies sit in front. It must match reality:
    too few reads a proxy's own address and lumps every customer together;
    too many reaches back into forgeable territory.
    """
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        hops = [part.strip() for part in forwarded.split(",") if part.strip()]
        if hops:
            index = max(0, len(hops) - max(1, trusted_hops))
            return hops[index]
    return request.client.host if request.client else None


def origin_key(ip: str | None) -> str | None:
    """Normalise an address to the unit a limit should count.

    IPv4 counts per address. IPv6 counts per /64, because that is what one
    customer is given: counting addresses would mean one household could make
    18 quintillion accounts without repeating itself.
    """
    if not ip:
        return None
    try:
        parsed = ipaddress.ip_address(ip)
    except ValueError:
        # Not an address at all - a forged or mangled header. Counted as
        # itself so it is still limited, rather than waved through.
        return ip[:64]

    if parsed.version == 6:
        return str(ipaddress.ip_network(f"{parsed}/64", strict=False))
    return str(parsed)


def hash_origin(key: str | None, settings: Settings) -> str | None:
    """Keyed hash of an origin, which is all that needs storing to count it."""
    if not key:
        return None
    secret = (settings.secret_encryption_key or settings.jwt_secret).encode()
    return hashlib.blake2b(key.encode(), key=secret[:64], digest_size=16).hexdigest()


def check_and_record(request: Request, db: Session, settings: Settings) -> str | None:
    """Raise if this origin is over its limit; otherwise return its hash.

    The caller stores the returned value on the new user, so the next signup
    from the same place is counted. Returns None when the limit is disabled or
    the address could not be determined - in both cases the account is allowed
    through, because refusing everyone whose address is unknown would turn a
    proxy misconfiguration into a total signup outage.
    """
    limit = settings.max_accounts_per_ip
    if limit <= 0:
        return None

    key = hash_origin(
        origin_key(client_ip(request, settings.trusted_proxy_hops)), settings
    )
    if not key:
        return None

    # 0 means no window at all: count every account this origin has ever
    # opened, which with a limit of 1 is "one account per network, ever".
    window_hours = max(0, settings.accounts_per_ip_window_hours)
    query = db.query(User).filter(User.signup_ip_hash == key)
    if window_hours:
        # Computed in Python rather than with a SQL interval expression, which
        # is spelled differently on every database and would tie this to
        # Postgres.
        cutoff = datetime.now(timezone.utc) - timedelta(hours=window_hours)
        query = query.filter(User.created_at >= cutoff)
    recent = query.count()
    if recent >= limit:
        logger.warning("Refused a signup: %d accounts already from this origin", recent)
        raise TooManyAccounts(limit=limit, window_hours=window_hours)
    return key
