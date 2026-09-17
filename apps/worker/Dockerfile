FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev gcc \
    && rm -rf /var/lib/apt/lists/*

# Build context is the repo root (see docker-compose.yml) so this image can
# reuse the api package's requirements and app code directly.
COPY apps/api/requirements.txt apps/api/requirements-postgres.txt ./
RUN pip install --no-cache-dir -r requirements.txt -r requirements-postgres.txt rq==2.1.0

COPY apps/api/app ./app
COPY apps/worker/jobs ./jobs
COPY apps/worker/run.py ./run.py

ENV PYTHONPATH=/app

CMD ["python", "run.py"]
