"""Refuses to start a production deployment that is configured insecurely.

A misconfigured production deployment does not look broken. The API answers
its health check, serves requests, and issues tokens — it simply does so with
a signing key printed in the public repository, or against a database that is
discarded on the next restart. Both states were reached by a real deployment
of this project: the host prompted for these values, nobody answered, and the
defaults quietly took over.

Failing to boot is the point. A deployment that stops is noticed and fixed in
minutes; one that silently serves forgeable tokens is not noticed at all.
"""

import os
from pathlib import Path

from app.core.config import Settings


class InsecureProductionConfigError(RuntimeError):
    """Raised at startup when production is running on development defaults."""


def verify_production_safety(settings: Settings) -> None:
    """Raise unless this configuration is safe to expose to the public."""
    if settings.environment.lower() != "production":
        return

    problems: list[str] = []

    if settings.jwt_secret == Settings.model_fields["jwt_secret"].default:
        problems.append(
            "JWT_SECRET is still the built-in default. It is published in this "
            "repository, so anyone who can read the source can mint a valid "
            "token for any account. Set it to a long random value "
            "(`openssl rand -hex 32`)."
        )

    if settings.database_url.startswith("sqlite"):
        problems.append(
            "DATABASE_URL still points at SQLite. On a managed host the "
            "filesystem is ephemeral, so every restart and every deploy "
            "discards all accounts and leads. Point it at your managed "
            "Postgres instance."
        )

    if problems:
        raise InsecureProductionConfigError(
            "Refusing to start: ENVIRONMENT=production with development "
            "defaults still in place.\n\n"
            + "\n\n".join(f"  * {problem}" for problem in problems)
            + "\n\n"
            + describe_config_sources()
        )


def describe_config_sources() -> str:
    """Report where configuration was looked for, without printing any values.

    When a deployment refuses to start, the next question is always "but I did
    set that", and the answer is usually a file under the wrong name or in the
    wrong place. Only names are listed here, never values, because this text
    goes straight into deploy logs.
    """
    lines = ["Where configuration was looked for:"]

    for label, path in (("secret file", Path("/etc/secrets/.env")), ("local env file", Path(".env"))):
        if not path.exists():
            lines.append(f"  - {label} {path}: NOT FOUND")
            continue
        try:
            keys = [
                line.split("=", 1)[0].strip()
                for line in path.read_text(encoding="utf-8").splitlines()
                if "=" in line and not line.lstrip().startswith("#")
            ]
        except OSError as exc:
            lines.append(f"  - {label} {path}: found but unreadable ({exc})")
            continue
        lines.append(
            f"  - {label} {path}: found, defines {len(keys)} key(s): "
            + (", ".join(keys) or "none")
        )

    secrets_dir = Path("/etc/secrets")
    if secrets_dir.is_dir():
        names = sorted(entry.name for entry in secrets_dir.iterdir())
        lines.append("  - files mounted in /etc/secrets: " + (", ".join(names) or "none"))
        if names and ".env" not in names:
            lines.append(
                "    NOTE: a secret file is mounted, but none is named '.env' - "
                "that is the only name this app reads. Rename it to '.env'."
            )
    else:
        lines.append("  - /etc/secrets does not exist (no secret files mounted)")

    present = [k for k in ("DATABASE_URL", "JWT_SECRET", "SECRET_ENCRYPTION_KEY") if os.environ.get(k)]
    lines.append("  - set as real environment variables: " + (", ".join(present) or "none"))

    return "\n".join(lines)
