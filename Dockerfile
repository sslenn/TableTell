# ==============================================================================
# Stage 1: Build Frontend Single-Page Application (React 19 + Vite)
# ==============================================================================
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

# Install dependencies
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install

# Build static bundle to /app/frontend/dist
COPY frontend/ ./

ARG VITE_CLERK_PUBLISHABLE_KEY
ENV VITE_CLERK_PUBLISHABLE_KEY=$VITE_CLERK_PUBLISHABLE_KEY

RUN npm run build

# ==============================================================================
# Stage 2: Production Python 3.13 Runtime (FastAPI + DuckDB)
# ==============================================================================
FROM python:3.13-slim

WORKDIR /app

# Install system dependencies (curl for healthchecks, gcc if needed for native modules)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Install Python requirements
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy backend application source
COPY backend/ /app/backend/

# Copy built frontend distribution from builder stage
COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist

# Create persistent storage directories
RUN mkdir -p /app/data_lake/raw /app/data_lake/processed /app/data_lake/metadata

# Configure environment variables
ENV PYTHONUNBUFFERED=1 \
    HOST=0.0.0.0 \
    PORT=8000 \
    ENVIRONMENT=production

EXPOSE 8000

# Container healthcheck using the /api/health endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/api/health || exit 1

WORKDIR /app/backend

# Launch production server
CMD ["python", "run.py"]
