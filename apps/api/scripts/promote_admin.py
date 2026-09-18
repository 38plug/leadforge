"""
Grant or revoke platform administrator access.

Run by a person, deliberately, rather than by the application: this flag is
the boundary around every account and workspace in the installation, so it is
not something the product hands out to itself.

    python scripts/promote_admin.py you@example.com
    python scripts/promote_admin.py you@example.com --revoke
    python scripts/promote_admin.py --list

The database is taken from DATABASE_URL, or from the repository's .env.local
if that variable is not set.
"""

import argparse
import pathlib
import re
import sys

from sqlalchemy import create_engine, text


def database_url() -> str:
    import os

    if os.environ.get("DATABASE_URL"):
        return os.environ["DATABASE_URL"]

    env_local = pathlib.Path(__file__).resolve().parents[3] / ".env.local"
    if env_local.exists():
        match = re.search(r"^DATABASE_URL=(.*)$", env_local.read_text(encoding="utf-8"), re.M)
        if match:
            return match.group(1).strip().strip('"').strip("'")

    sys.exit(
        "No database configured. Set DATABASE_URL, or run this from a checkout "
        "that has .env.local at its root."
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Manage platform administrator access.")
    parser.add_argument("email", nargs="?", help="Account to grant or revoke access for")
    parser.add_argument("--revoke", action="store_true", help="Remove access instead of granting it")
    parser.add_argument("--list", action="store_true", help="Show every account and its access")
    args = parser.parse_args()

    engine = create_engine(database_url(), pool_pre_ping=True)

    if args.list or not args.email:
        with engine.connect() as connection:
            rows = list(
                connection.execute(
                    text("select email, is_superuser, is_active from users order by created_at")
                )
            )
        if not rows:
            print("No accounts exist yet.")
            return
        print(f"{'ACCOUNT':44} {'ADMIN':7} ACTIVE")
        for email, is_superuser, is_active in rows:
            print(f"{email:44} {'yes' if is_superuser else 'no':7} {'yes' if is_active else 'no'}")
        if not args.email:
            print("\nPass an email address to grant access, or --revoke to remove it.")
        return

    grant = not args.revoke
    with engine.begin() as connection:
        updated = connection.execute(
            text("update users set is_superuser = :grant where email = :email"),
            {"grant": grant, "email": args.email},
        ).rowcount

    if not updated:
        sys.exit(
            f"No account found for {args.email!r}. Run with --list to see which accounts exist - "
            "the address must match one that has actually registered."
        )

    print(f"{'Granted' if grant else 'Revoked'} platform administrator access for {args.email}.")
    if grant:
        print("Sign out and back in for the change to take effect in the browser.")


if __name__ == "__main__":
    main()
