"""
Create the Stripe webhook endpoint and capture its signing secret.

The secret is returned only once, when the endpoint is created - Stripe will
not show it again through the API afterwards, only in the Dashboard. So this
writes it straight into .env.render.local rather than printing it, which keeps
a credential out of terminal scrollback and shell history.

    python scripts/setup_stripe_webhook.py            # show what it would do
    python scripts/setup_stripe_webhook.py --apply    # create it

Re-running is safe: an endpoint already pointing at the same URL is reported
rather than duplicated, because two endpoints means every event is delivered
twice.
"""

import argparse
import pathlib
import re
import sys

import stripe

STRIPE_API_VERSION = "2026-08-26.dahlia"

API_URL = "https://leadforge-api-vnop.onrender.com/api/billing/webhook"

# Only the events the handler acts on. Subscribing to everything means the
# endpoint is woken for traffic it ignores, and a noisy delivery log hides the
# failures that matter.
EVENTS = [
    "checkout.session.completed",
    "customer.subscription.created",
    "customer.subscription.updated",
    "customer.subscription.deleted",
    "invoice.payment_failed",
]

ENV_FILE = pathlib.Path(__file__).resolve().parents[3] / ".env.render.local"


def secret_key() -> str:
    import os

    if os.environ.get("STRIPE_SECRET_KEY"):
        return os.environ["STRIPE_SECRET_KEY"]
    if ENV_FILE.exists():
        match = re.search(r"^STRIPE_SECRET_KEY=(.*)$", ENV_FILE.read_text(encoding="utf-8"), re.M)
        if match and match.group(1).strip():
            return match.group(1).strip()
    sys.exit("No STRIPE_SECRET_KEY found. Set it, or put it in .env.render.local.")


def store_secret(value: str) -> None:
    """Replace STRIPE_WEBHOOK_SECRET in the env file, keeping everything else."""
    lines = ENV_FILE.read_text(encoding="utf-8").splitlines() if ENV_FILE.exists() else []
    replaced = False
    for index, line in enumerate(lines):
        if line.startswith("STRIPE_WEBHOOK_SECRET="):
            lines[index] = f"STRIPE_WEBHOOK_SECRET={value}"
            replaced = True
    if not replaced:
        lines.append(f"STRIPE_WEBHOOK_SECRET={value}")
    ENV_FILE.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description="Create the Stripe webhook endpoint.")
    parser.add_argument("--apply", action="store_true", help="Actually create it")
    parser.add_argument("--url", default=API_URL, help="Endpoint URL to register")
    args = parser.parse_args()

    key = secret_key()
    client = stripe.StripeClient(key, stripe_version=STRIPE_API_VERSION)
    print(f"Stripe environment: {'LIVE' if '_live_' in key else 'TEST'}")
    print(f"Endpoint URL      : {args.url}\n")

    for endpoint in client.v1.webhook_endpoints.list(params={"limit": 100}).data:
        if endpoint.url == args.url:
            print(f"An endpoint for this URL already exists: {endpoint.id}")
            print(
                "Stripe only reveals a signing secret at creation. Read it from the\n"
                "Dashboard (Developers -> Webhooks -> this endpoint -> Reveal), or delete\n"
                "the endpoint and re-run this to get a fresh one."
            )
            return

    if not args.apply:
        print("Would create an endpoint subscribed to:")
        for event in EVENTS:
            print(f"  {event}")
        print("\nDry run. Re-run with --apply to create it.")
        return

    endpoint = client.v1.webhook_endpoints.create(
        params={
            "url": args.url,
            "enabled_events": EVENTS,
            "description": "LeadForge subscription billing",
            "api_version": STRIPE_API_VERSION,
        }
    )

    store_secret(endpoint.secret)
    print(f"Created {endpoint.id}")
    print(f"Subscribed to {len(EVENTS)} events")
    print(f"Signing secret written to {ENV_FILE.name} ({len(endpoint.secret)} chars, starts whsec_)")
    print("\nCopy that value into the Render secret file for the API to verify webhooks.")


if __name__ == "__main__":
    main()
