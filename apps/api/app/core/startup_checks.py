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
        )
