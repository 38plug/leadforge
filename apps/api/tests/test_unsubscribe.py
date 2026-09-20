"""
The public unsubscribe endpoint.

It is reached by a recipient clicking a link in an email, often long after it
was sent, and it is the one route in the product that anyone on the internet
can call. Both of those shape what it has to do when the request does not
match anything.
"""

from app.models.campaign import SuppressionEntry


def test_a_recipient_can_unsubscribe(client, demo_workspace, db_session):
    response = client.post(
        f"/api/campaigns/unsubscribe?workspace_id={demo_workspace.id}&email=someone@example.com"
    )

    assert response.status_code == 204
    assert db_session.query(SuppressionEntry).count() == 1


def test_it_works_without_the_workspace_having_email_settings(client, demo_workspace):
    """Unsubscribing sends nothing, so it must not depend on an outbound
    mailbox being configured - and must not decrypt the SMTP password."""
    assert (
        client.post(
            f"/api/campaigns/unsubscribe?workspace_id={demo_workspace.id}&email=a@b.com"
        ).status_code
        == 204
    )


def test_an_unknown_workspace_does_not_return_an_error(client, db_session):
    """This used to raise a foreign key violation and return 500 from a link
    a recipient clicked in good faith. A stale link should say "done", not
    "something went wrong"."""
    response = client.post(
        "/api/campaigns/unsubscribe?workspace_id=does-not-exist&email=x@example.com"
    )

    assert response.status_code == 204
    assert db_session.query(SuppressionEntry).count() == 0


def test_unsubscribing_twice_is_harmless(client, demo_workspace, db_session):
    """Mail clients prefetch links, so the same request arrives more than once."""
    url = f"/api/campaigns/unsubscribe?workspace_id={demo_workspace.id}&email=twice@example.com"

    assert client.post(url).status_code == 204
    assert client.post(url).status_code == 204
    assert db_session.query(SuppressionEntry).count() == 1
