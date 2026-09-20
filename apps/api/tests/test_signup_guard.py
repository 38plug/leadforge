"""
Limiting how many accounts one origin can create.

The free plan's weekly allowance is what this protects. The tests split into
two halves that pull against each other, and both matter: the limit has to
bite on farming, and it has to leave alone the shared connections that real
customers sit behind.
"""

from datetime import datetime, timezone

import pytest

from app.core.config import get_settings
from app.models.workspace import User
from app.services import signup_guard


def _register(client, email: str, ip: str = "203.0.113.7"):
    return client.post(
        "/api/auth/register",
        json={
            "email": email,
            "password": "GoodPassword123",
            "full_name": "Test Person",
            "workspace_name": f"WS {email.split('@')[0]}",
        },
        headers={"X-Forwarded-For": ip},
    )


def test_one_account_per_network(client):
    """The configured rule: one account per network, by the product owner's
    decision. The cost is that the second person in a shared office is
    refused and has to contact support - which the refusal tells them."""
    assert get_settings().max_accounts_per_ip == 1

    assert _register(client, "first@studio.example").status_code == 201
    assert _register(client, "colleague@studio.example").status_code == 429


def test_the_refusal_reads_properly_at_a_limit_of_one(client):
    """"1 accounts have already been created" is the kind of sentence that
    makes a product look unfinished, and most people who see this are the
    second person in an office rather than a farmer."""
    _register(client, "first-there@example.com")

    detail = _register(client, "second-there@example.com").json()["detail"]

    assert "Only one account" in detail
    assert "1 accounts" not in detail
    assert "contact support" in detail, "a real customer needs a way forward"


def test_the_limit_can_be_made_lifelong(db_session, monkeypatch):
    """A window of 0 counts every account the origin ever opened, so "one per
    network" means once rather than once a week."""
    settings = get_settings()
    monkeypatch.setattr(settings, "accounts_per_ip_window_hours", 0, raising=False)

    class Request:
        headers = {"x-forwarded-for": "203.0.113.7"}
        client = None

    key = signup_guard.check_and_record(Request(), db_session, settings)
    from app.core.security import hash_password

    db_session.add(
        User(
            email="long-ago@example.com",
            hashed_password=hash_password("Pass123456"),
            signup_ip_hash=key,
            created_at=datetime(2020, 1, 1, tzinfo=timezone.utc),
        )
    )
    db_session.commit()

    with pytest.raises(signup_guard.TooManyAccounts):
        signup_guard.check_and_record(Request(), db_session, settings)


def test_farming_more_accounts_from_one_network_is_refused(client):
    settings = get_settings()
    for index in range(settings.max_accounts_per_ip):
        _register(client, f"farm{index}@example.com")

    response = _register(client, "farm-one-too-many@example.com")

    assert response.status_code == 429
    assert "shared office" in response.json()["detail"], (
        "a legitimate user caught by this needs to be told what to do about it"
    )


def test_a_different_origin_is_unaffected(client):
    settings = get_settings()
    for index in range(settings.max_accounts_per_ip):
        _register(client, f"first{index}@example.com", ip="203.0.113.7")

    response = _register(client, "someone-else@example.com", ip="198.51.100.20")
    assert response.status_code == 201


def test_a_refused_signup_leaves_nothing_behind(client, db_session):
    """Checked before the account, the workspace or the slug are written, so
    a refusal cannot consume a workspace name or leave a half-made account."""
    settings = get_settings()
    for index in range(settings.max_accounts_per_ip):
        _register(client, f"before{index}@example.com")
    before = db_session.query(User).count()

    _register(client, "refused@example.com")

    assert db_session.query(User).count() == before
    assert db_session.query(User).filter(User.email == "refused@example.com").first() is None


# --- how an origin is identified -----------------------------------------


def test_the_address_is_never_stored_in_the_clear(client, db_session):
    """An IP is personal data, and counting needs only equality."""
    _register(client, "hashed@example.com", ip="203.0.113.99")

    user = db_session.query(User).filter(User.email == "hashed@example.com").first()
    assert user.signup_ip_hash
    assert "203.0.113.99" not in user.signup_ip_hash


def test_ipv6_is_counted_by_its_64_not_by_address():
    """A residential IPv6 customer gets a whole /64 and can use a different
    address per request, so counting addresses would be no limit at all."""
    first = signup_guard.origin_key("2001:db8:1234:5678::1")
    second = signup_guard.origin_key("2001:db8:1234:5678::dead:beef")
    other_customer = signup_guard.origin_key("2001:db8:1234:9999::1")

    assert first == second
    assert first != other_customer


def test_ipv4_is_counted_per_address():
    assert signup_guard.origin_key("203.0.113.7") != signup_guard.origin_key("203.0.113.8")


def _request_with(forwarded: str):
    from starlette.datastructures import Headers

    class FakeRequest:
        headers = Headers({"x-forwarded-for": forwarded})
        client = None

    return FakeRequest()


def test_the_address_is_read_from_the_proxy_end_not_the_caller_end():
    """With one proxy in front, the last entry is what Render actually saw."""
    assert signup_guard.client_ip(_request_with("203.0.113.7"), trusted_hops=1) == "203.0.113.7"


def test_a_caller_cannot_choose_their_own_apparent_address():
    """The bug this guards against: taking the leftmost entry would let
    anyone bypass the limit by sending one header, which is exactly the
    person the limit exists for.

    Here the caller claims to be 1.2.3.4 and the proxy appends what it saw.
    The claim must be ignored."""
    forged = _request_with("1.2.3.4, 203.0.113.7")

    assert signup_guard.client_ip(forged, trusted_hops=1) == "203.0.113.7"


def test_extra_proxies_are_configurable():
    """Two proxies in front means the caller is two entries from the right."""
    chain = _request_with("1.2.3.4, 203.0.113.7, 10.0.0.1")

    assert signup_guard.client_ip(chain, trusted_hops=2) == "203.0.113.7"


def test_a_mangled_header_is_still_counted_rather_than_waved_through():
    """A forged or broken value is not an address, but it must not become a
    free pass - it is counted as itself."""
    key = signup_guard.origin_key("not-an-ip-at-all")
    assert key == "not-an-ip-at-all"


def test_an_unknown_origin_does_not_block_signup(db_session):
    """If the address cannot be determined at all - a proxy misconfiguration -
    the account is allowed. Refusing everyone would turn one bad header into
    a total signup outage, which is far worse than the farming it prevents."""

    class NoAddress:
        headers = {}
        client = None

    assert signup_guard.check_and_record(NoAddress(), db_session, get_settings()) is None


def test_the_limit_can_be_turned_off(db_session, monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "max_accounts_per_ip", 0, raising=False)

    class Request:
        headers = {"x-forwarded-for": "203.0.113.7"}
        client = None

    assert signup_guard.check_and_record(Request(), db_session, settings) is None


# --- seeing it happen ----------------------------------------------------


def test_an_admin_can_see_accounts_sharing_an_origin(client, db_session):
    """A limit nobody can observe being hit is not much use: the point is to
    notice farming, not only to slow it."""
    from app.core.security import hash_password
    from app.models.workspace import Workspace, WorkspaceMember, WorkspaceRole

    admin = User(
        email="origin-admin@example.com",
        hashed_password=hash_password("AdminPass123"),
        is_superuser=True,
    )
    db_session.add(admin)
    db_session.flush()
    workspace = Workspace(name="Admin", slug="origin-admin-ws")
    db_session.add(workspace)
    db_session.flush()
    db_session.add(
        WorkspaceMember(workspace_id=workspace.id, user_id=admin.id, role=WorkspaceRole.OWNER)
    )
    db_session.commit()

    _register(client, "pair-a@example.com", ip="203.0.113.50")
    _register(client, "alone@example.com", ip="198.51.100.77")
    # The second account from that network is added directly: at a limit of 1
    # registration would refuse it, but support raising the limit for a real
    # office is exactly how a cluster comes to exist, and that is the case an
    # admin needs to be able to see.
    shared = db_session.query(User).filter(User.email == "pair-a@example.com").first()
    db_session.add(
        User(
            email="pair-b@example.com",
            hashed_password=hash_password("Pass123456"),
            signup_ip_hash=shared.signup_ip_hash,
        )
    )
    db_session.commit()

    from app.core.security import create_access_token

    rows = client.get(
        "/api/admin/users", headers={"Authorization": f"Bearer {create_access_token(admin.id)}"}
    ).json()
    by_email = {row["email"]: row for row in rows}

    assert by_email["pair-a@example.com"]["accounts_from_same_origin"] == 2
    assert by_email["alone@example.com"]["accounts_from_same_origin"] == 1


def test_accounts_predating_the_guard_are_not_grouped_together(client, db_session):
    """They have no recorded origin. Treating a shared NULL as "same place"
    would flag every existing customer as a farm on the day this shipped."""
    from app.core.security import hash_password

    for email in ("old-a@example.com", "old-b@example.com"):
        db_session.add(User(email=email, hashed_password=hash_password("Pass123456")))
    db_session.commit()

    from app.routers.admin import _user_out

    user = db_session.query(User).filter(User.email == "old-a@example.com").first()
    assert _user_out(db_session, user).accounts_from_same_origin == 1


def test_the_configured_rule_is_one_account_per_network_forever(client, db_session):
    """One IP, one account, for all time - not one per week.

    An account created long ago still blocks a new signup from that origin,
    which is the whole point of a window of 0 and the thing a rolling window
    would quietly undo.
    """
    settings = get_settings()
    assert settings.max_accounts_per_ip == 1
    assert settings.accounts_per_ip_window_hours == 0, "0 means no window at all"

    _register(client, "the-one@example.com", ip="203.0.113.200")
    user = db_session.query(User).filter(User.email == "the-one@example.com").first()
    # Backdated well beyond any plausible rolling window.
    user.created_at = datetime(2021, 1, 1, tzinfo=timezone.utc)
    db_session.commit()

    response = _register(client, "much-later@example.com", ip="203.0.113.200")

    assert response.status_code == 429
    assert "every" not in response.json()["detail"], (
        "with no window the message must not promise the limit resets"
    )
