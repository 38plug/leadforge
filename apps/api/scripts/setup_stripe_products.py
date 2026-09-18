"""
Create the Products and Prices that back LeadForge's paid plans.

Run once per Stripe environment (once in the sandbox, once in live mode).
It is idempotent: a plan that already has a matching active price is left
alone, so re-running after adding a tier does not create duplicates - and
duplicate prices are genuinely harmful, because a customer can end up
subscribed to an old one that nobody is tracking.

    python scripts/setup_stripe_products.py            # show what it would do
    python scripts/setup_stripe_products.py --apply    # create what is missing

The amounts mirror the plans already shown in Settings. They live in Stripe
once created, so changing a price later is a Dashboard action, not a deploy.
"""

import argparse
import pathlib
import re
import sys

import stripe

STRIPE_API_VERSION = "2026-08-26.dahlia"

PLANS = [
    {
        "plan": "STARTER",
        "name": "LeadForge Starter",
        "description": "500 lead unlocks a month, 2 seats.",
        "amount_cents": 2900,
        "env_var": "STRIPE_PRICE_STARTER",
    },
    {
        "plan": "PRO",
        "name": "LeadForge Pro",
        "description": "2,000 lead unlocks a month, 5 seats.",
        "amount_cents": 7900,
        "env_var": "STRIPE_PRICE_PRO",
    },
    {
        "plan": "AGENCY",
        "name": "LeadForge Agency",
        "description": "10,000 lead unlocks a month, 15 seats.",
        "amount_cents": 19900,
        "env_var": "STRIPE_PRICE_AGENCY",
    },
]

CURRENCY = "usd"


def secret_key() -> str:
    import os

    if os.environ.get("STRIPE_SECRET_KEY"):
        return os.environ["STRIPE_SECRET_KEY"]

    env_file = pathlib.Path(__file__).resolve().parents[3] / ".env.render.local"
    if env_file.exists():
        match = re.search(r"^STRIPE_SECRET_KEY=(.*)$", env_file.read_text(encoding="utf-8"), re.M)
        if match and match.group(1).strip():
            return match.group(1).strip()

    sys.exit("No STRIPE_SECRET_KEY found. Set it, or put it in .env.render.local.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Create LeadForge's Stripe products and prices.")
    parser.add_argument("--apply", action="store_true", help="Actually create them (otherwise dry run)")
    args = parser.parse_args()

    key = secret_key()
    if key.startswith(("sk_live", "rk_live")) and args.apply:
        confirm = input("This is a LIVE key. Create real products? Type 'live' to continue: ")
        if confirm.strip().lower() != "live":
            sys.exit("Stopped.")

    client = stripe.StripeClient(key, stripe_version=STRIPE_API_VERSION)
    mode = "LIVE" if "_live_" in key else "TEST"
    print(f"Stripe environment: {mode}\n")

    existing_products = {p.name: p for p in client.v1.products.list(params={"limit": 100}).data}
    existing_prices = client.v1.prices.list(params={"limit": 100, "active": True}).data

    results: list[tuple[str, str]] = []

    for spec in PLANS:
        # A price is "the same" when it is the same amount, currency and
        # interval on the same product. Anything else is a new price.
        product = existing_products.get(spec["name"])
        match = next(
            (
                price
                for price in existing_prices
                if product
                and price.product == product.id
                and price.unit_amount == spec["amount_cents"]
                and price.currency == CURRENCY
                and price.recurring
                and price.recurring.interval == "month"
            ),
            None,
        )

        if match:
            print(f"  {spec['plan']:8} already exists  {match.id}")
            results.append((spec["env_var"], match.id))
            continue

        if not args.apply:
            amount = spec["amount_cents"] / 100
            print(f"  {spec['plan']:8} would create   ${amount:.2f}/month  {spec['name']}")
            continue

        if not product:
            product = client.v1.products.create(
                params={
                    "name": spec["name"],
                    "description": spec["description"],
                    # Lets the webhook and the admin screen tie a Stripe object
                    # back to a plan without a hard-coded id table.
                    "metadata": {"leadforge_plan": spec["plan"]},
                }
            )

        price = client.v1.prices.create(
            params={
                "product": product.id,
                "unit_amount": spec["amount_cents"],
                "currency": CURRENCY,
                "recurring": {"interval": "month"},
                "metadata": {"leadforge_plan": spec["plan"]},
            }
        )
        print(f"  {spec['plan']:8} created        {price.id}")
        results.append((spec["env_var"], price.id))

    if not args.apply:
        print("\nDry run. Re-run with --apply to create them.")
        return

    if results:
        print("\nAdd these to your environment (Render secret file and .env.render.local):\n")
        for env_var, price_id in results:
            print(f"{env_var}={price_id}")


if __name__ == "__main__":
    main()
