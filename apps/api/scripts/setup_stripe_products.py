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

Descriptions are only written when a product is first created. Editing one
here does not rewrite a product that already exists in Stripe - that is a
Dashboard edit.
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
        "description": "500 lead unlocks a week, 2 seats.",
        "amount_cents": 2900,
        "env_var": "STRIPE_PRICE_STARTER",
    },
    {
        "plan": "PRO",
        "name": "LeadForge Pro",
        "description": "2,000 lead unlocks a week, 5 seats.",
        "amount_cents": 7900,
        "env_var": "STRIPE_PRICE_PRO",
    },
    {
        "plan": "AGENCY",
        "name": "LeadForge Agency",
        "description": "10,000 lead unlocks a week, 15 seats.",
        "amount_cents": 19900,
        "env_var": "STRIPE_PRICE_AGENCY",
    },
]

# The one-off pack. A one-time price rather than a subscription: it is bought
# when someone needs more this week, on any plan including FREE, and billing
# it monthly would charge for something nobody agreed to.
#
# The number of unlocks granted is decided by the application (CREDIT_PACK_SIZE
# in the API settings), not read back from this product, so the two must be
# kept in step. That is why the size appears in the description and metadata.
CREDIT_PACK = {
    # Renamed as well as repriced: a price is a property of the Price object,
    # but this script matches an existing product by name. Reusing the old
    # name would attach a second price to the 200-lead product and leave the
    # Dashboard describing a pack nobody can buy.
    "name": "LeadForge Lead Pack (50)",
    "description": "50 extra lead unlocks. One-off purchase, does not expire.",
    "amount_cents": 1000,
    "credits": 50,
    "env_var": "STRIPE_PRICE_CREDIT_PACK",
}

CURRENCY = "usd"

# Stripe requires a tax code on every product sold through Managed Payments,
# which is on by default for new accounts. Without it, creating a Checkout
# Session fails outright - so this is not optional metadata.
#
# LeadForge is software sold to businesses, so "SaaS - business use" is the
# correct classification. Getting this wrong misreports tax rather than
# failing loudly, which is why it is stated rather than guessed.
SAAS_BUSINESS_TAX_CODE = "txcd_10103001"


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
                    "tax_code": SAAS_BUSINESS_TAX_CODE,
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

    # --- the one-off pack ------------------------------------------------
    # A one-time price, so the "same price" test is the absence of `recurring`
    # rather than a matching interval.
    pack_product = existing_products.get(CREDIT_PACK["name"])
    pack_match = next(
        (
            price
            for price in existing_prices
            if pack_product
            and price.product == pack_product.id
            and price.unit_amount == CREDIT_PACK["amount_cents"]
            and price.currency == CURRENCY
            and not price.recurring
        ),
        None,
    )

    if pack_match:
        print(f"  {'PACK':8} already exists  {pack_match.id}")
        results.append((CREDIT_PACK["env_var"], pack_match.id))
    elif not args.apply:
        amount = CREDIT_PACK["amount_cents"] / 100
        print(f"  {'PACK':8} would create   ${amount:.2f} one-off  {CREDIT_PACK['name']}")
    else:
        if not pack_product:
            pack_product = client.v1.products.create(
                params={
                    "name": CREDIT_PACK["name"],
                    "description": CREDIT_PACK["description"],
                    "tax_code": SAAS_BUSINESS_TAX_CODE,
                    "metadata": {"leadforge_credits": str(CREDIT_PACK["credits"])},
                }
            )
        pack_price = client.v1.prices.create(
            params={
                "product": pack_product.id,
                "unit_amount": CREDIT_PACK["amount_cents"],
                "currency": CURRENCY,
                "metadata": {"leadforge_credits": str(CREDIT_PACK["credits"])},
            }
        )
        print(f"  {'PACK':8} created        {pack_price.id}")
        results.append((CREDIT_PACK["env_var"], pack_price.id))

    if not args.apply:
        print("\nDry run. Re-run with --apply to create them.")
        return

    if results:
        print("\nAdd these to your environment (Render secret file and .env.render.local):\n")
        for env_var, price_id in results:
            print(f"{env_var}={price_id}")


if __name__ == "__main__":
    main()
