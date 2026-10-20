# Build from the repo root:  docker build -f api/Dockerfile -t haqdar-api .
FROM python:3.13-slim
COPY --from=ghcr.io/astral-sh/uv:0.11.32 /uv /usr/local/bin/uv
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy PYTHONUNBUFFERED=1
# Layout /app/api + /app/data: config.py finds data/ two levels above app/.
WORKDIR /app/api
COPY api/pyproject.toml api/uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project
COPY api/app ./app
COPY data /app/data
RUN mkdir -p /var/lib/haqdar
ENV PATH="/app/api/.venv/bin:$PATH" HAQDAR_DATABASE_URL=sqlite:////var/lib/haqdar/haqdar.db
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
