"""
Worker entry point.

Starts an RQ worker listening on the default queue. Requires Redis
(REDIS_URL in the environment) and the API package importable on
PYTHONPATH — run from the repo root with:

    PYTHONPATH=apps/api python apps/worker/run.py

Jobs are enqueued by the API (e.g. after a lead search, or on a nightly
scheduler) with `queue.enqueue("jobs.website_check.check_company_website", company_id)`.
"""

import sys
from pathlib import Path

# Local dev: apps/api is a sibling directory and must be added explicitly.
# In the worker Docker image, `app/` is copied straight into the image root
# and PYTHONPATH=/app already covers it, so this is a harmless no-op there.
_local_api_path = Path(__file__).resolve().parents[2] / "apps" / "api"
if _local_api_path.exists():
    sys.path.insert(0, str(_local_api_path))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from redis import Redis
from rq import Queue, Worker

from app.core.config import get_settings

if __name__ == "__main__":
    settings = get_settings()
    connection = Redis.from_url(settings.redis_url)
    queue = Queue("default", connection=connection)
    worker = Worker([queue], connection=connection)
    worker.work()
