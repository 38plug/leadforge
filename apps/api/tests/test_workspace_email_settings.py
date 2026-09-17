"""Each workspace sends from its own mailbox, and its password never leaks."""

from app.core.config import get_settings
from app.core.crypto import decrypt_secret, encrypt_secret
from app.models.workspace import WorkspaceEmailSettings
from app.providers.email import RecordingEmailProvider, SMTPEmailProvider, get_workspace_email_provider

PAYLOAD = {
    "from_address": "owner@example.com",
    "from_name": "Owner",
    "smtp_host": "smtp.gmail.com",
    "smtp_port": 587,
    "smtp_username": "owner@example.com",
    "smtp_password": "app-password-1234",
    "daily_send_limit": 150,
}


def test_a_workspace_starts_with_no_mailbox_connected(client, auth_headers):
    body = client.get("/api/workspace/email-settings", headers=auth_headers).json()
    assert body["configured"] is False
    assert body["from_address"] is None


def test_saving_settings_never_returns_the_password(client, auth_headers):
    response = client.put("/api/workspace/email-settings", json=PAYLOAD, headers=auth_headers)
    assert response.status_code == 200

    body = response.json()
    assert body["configured"] is True
    assert body["from_address"] == "owner@example.com"
    # The password must not appear under any key, in any form.
    assert "app-password-1234" not in response.text
    assert "smtp_password" not in body


def test_the_password_is_encrypted_at_rest(client, auth_headers, db_session, demo_workspace):
    client.put("/api/workspace/email-settings", json=PAYLOAD, headers=auth_headers)

    row = (
        db_session.query(WorkspaceEmailSettings)
        .filter(WorkspaceEmailSettings.workspace_id == demo_workspace.id)
        .first()
    )
    assert row is not None
    assert "app-password-1234" not in row.smtp_password_encrypted
    assert decrypt_secret(row.smtp_password_encrypted, get_settings()) == "app-password-1234"


def test_editing_without_a_password_keeps_the_stored_one(client, auth_headers, db_session, demo_workspace):
    client.put("/api/workspace/email-settings", json=PAYLOAD, headers=auth_headers)
    before = (
        db_session.query(WorkspaceEmailSettings)
        .filter(WorkspaceEmailSettings.workspace_id == demo_workspace.id)
        .first()
        .smtp_password_encrypted
    )

    edit = {**PAYLOAD, "from_name": "New Name"}
    edit.pop("smtp_password")
    response = client.put("/api/workspace/email-settings", json=edit, headers=auth_headers)

    assert response.status_code == 200
    assert response.json()["from_name"] == "New Name"
    db_session.expire_all()
    after = (
        db_session.query(WorkspaceEmailSettings)
        .filter(WorkspaceEmailSettings.workspace_id == demo_workspace.id)
        .first()
        .smtp_password_encrypted
    )
    assert after == before


def test_a_workspace_sends_through_its_own_mailbox(client, auth_headers, db_session, demo_workspace):
    client.put("/api/workspace/email-settings", json=PAYLOAD, headers=auth_headers)

    provider = get_workspace_email_provider(db_session, demo_workspace.id, get_settings())

    assert isinstance(provider, SMTPEmailProvider)
    assert provider.host == "smtp.gmail.com"
    assert provider.from_address == "Owner <owner@example.com>"


def test_a_workspace_without_settings_does_not_borrow_another_ones(db_session, demo_workspace):
    # A second workspace's configured mailbox must never be picked up here.
    db_session.add(
        WorkspaceEmailSettings(
            workspace_id="some-other-workspace",
            from_address="other@example.com",
            smtp_host="smtp.other.com",
            smtp_username="other@example.com",
            smtp_password_encrypted=encrypt_secret("secret", get_settings()),
        )
    )
    db_session.commit()

    provider = get_workspace_email_provider(db_session, demo_workspace.id, get_settings())

    assert isinstance(provider, RecordingEmailProvider)


def test_smtp_host_is_suggested_from_the_email_domain(client, auth_headers):
    body = client.get("/api/workspace/email-settings/suggest?email=me@gmail.com", headers=auth_headers).json()
    assert body == {"known": True, "smtp_host": "smtp.gmail.com", "smtp_port": 587, "provider": "gmail.com"}


def test_an_unknown_domain_is_reported_as_unknown(client, auth_headers):
    body = client.get("/api/workspace/email-settings/suggest?email=me@acme-corp.dev", headers=auth_headers).json()
    assert body == {"known": False}


def test_disconnecting_removes_the_stored_credentials(client, auth_headers, db_session, demo_workspace):
    client.put("/api/workspace/email-settings", json=PAYLOAD, headers=auth_headers)

    assert client.delete("/api/workspace/email-settings", headers=auth_headers).status_code == 204

    remaining = (
        db_session.query(WorkspaceEmailSettings)
        .filter(WorkspaceEmailSettings.workspace_id == demo_workspace.id)
        .count()
    )
    assert remaining == 0
