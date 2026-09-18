"""
Registration must reject addresses that cannot receive mail.

A real account was created as "latinoxindestry@gmail.com." - with a trailing
dot - which no mail server will route. With confirmation and password reset
now sent by email, an unreachable address means an account that can never be
confirmed and never recovered.
"""

import pytest


BAD_ADDRESSES = [
    pytest.param("someone@gmail.com.", id="trailing-dot"),
    pytest.param("no-at-sign", id="no-at"),
    pytest.param("missing@domain", id="no-tld"),
    pytest.param("spaces in@example.com", id="spaces"),
    pytest.param("two@@example.com", id="double-at"),
    pytest.param("@example.com", id="no-local-part"),
    pytest.param("", id="empty"),
]


@pytest.mark.parametrize("address", BAD_ADDRESSES)
def test_registration_refuses_an_unreachable_address(client, address):
    response = client.post(
        "/api/auth/register",
        json={
            "email": address,
            "password": "ValidPass123",
            "full_name": "Test Person",
            "workspace_name": "Test Studio",
        },
    )
    assert response.status_code == 422, f"{address!r} should be refused"


def test_a_valid_address_is_accepted(client):
    response = client.post(
        "/api/auth/register",
        json={
            "email": "person@example.com",
            "password": "ValidPass123",
            "full_name": "Test Person",
            "workspace_name": "Test Studio",
        },
    )
    assert response.status_code == 201


def test_addresses_are_normalised(client):
    """Otherwise Person@Example.com and person@example.com are two accounts,
    and a reset requested for one does not reach the other."""
    created = client.post(
        "/api/auth/register",
        json={
            "email": "  Person@Example.COM ",
            "password": "ValidPass123",
            "full_name": "Test Person",
            "workspace_name": "Test Studio",
        },
    )
    assert created.status_code == 201
    assert created.json()["user"]["email"] == "person@example.com"

    duplicate = client.post(
        "/api/auth/register",
        json={
            "email": "PERSON@example.com",
            "password": "ValidPass123",
            "full_name": "Impostor",
            "workspace_name": "Other",
        },
    )
    assert duplicate.status_code == 409, "case must not create a second account"


def test_sign_in_is_case_insensitive(client):
    client.post(
        "/api/auth/register",
        json={
            "email": "casing@example.com",
            "password": "ValidPass123",
            "full_name": "Test",
            "workspace_name": "Casing",
        },
    )
    response = client.post("/api/auth/login", json={"email": "Casing@Example.com", "password": "ValidPass123"})
    assert response.status_code == 200
