# TableTell VPS Production Deployment Guide

This guide provides step-by-step instructions for deploying TableTell on a Linux Virtual Private Server (VPS) such as **DigitalOcean, Hetzner, AWS EC2, Linode, or OVH**.

---

## 🏛 Architecture Overview

TableTell utilizes a high-performance **hybrid embedded architecture**:
- **In-Process Analytical Engine**: DuckDB executes vectorized columnar queries directly against Parquet files stored in `data_lake/`.
- **Relational Metadata Store**: SQLite (`tabletell_metadata.db`) stores dataset catalogs, audit trails, and execution run histories.
- **Agent Workflow Engine**: LangGraph orchestrates SQL generation, execution, self-healing, and Plotly visualization.
- **Frontend SPA**: React 19 + Vite compiled into static assets served with client-side routing.

> [!TIP]
> A VPS with high-speed SSD/NVMe storage is the **optimal environment** for TableTell. Because DuckDB and Parquet leverage zero-copy local disk reads, queries on a VPS execute in sub-milliseconds without network serialization overhead.

---

## 🚀 Option 1: Docker Compose Deployment (Recommended)

This is the fastest, cleanest, and most reliable method to deploy TableTell.

### 1. Prerequisites on VPS
Ensure Docker and Docker Compose are installed:
```bash
# Ubuntu / Debian
sudo apt update && sudo apt install -y docker.io docker-compose-plugin
sudo systemctl enable --now docker
```

### 2. Clone Repository & Configure Environment
```bash
git clone <your-repository-url> /opt/tabletell
cd /opt/tabletell

# Copy production environment template
cp deploy/.env.production.example .env

# Edit .env and set your Google Gemini API key
nano .env
```

Ensure `.env` contains:
```ini
GEMINI_API_KEY=your_gemini_api_key_here
ENVIRONMENT=production
PORT=8000
```

### 3. Launch with Docker Compose
```bash
# Build frontend, package Python 3.13 backend, and start container
docker compose up -d --build

# Verify container is running and healthy
docker compose ps
docker compose logs -f
```

The container automatically mounts `./data_lake:/app/backend/data_lake` on the host, ensuring **all uploaded datasets, parquet conversions, and SQLite audit histories persist across container rebuilds**.

---

## 🌐 Reverse Proxy & SSL Setup

Do not expose port 8000 directly to the internet. Instead, place **Nginx** or **Caddy** in front to handle HTTPS certificates and request routing.

### A. Using Caddy (Easiest - Automatic SSL)
Caddy automatically provisions and renews Let's Encrypt SSL certificates with zero configuration.

1. Install Caddy:
   ```bash
   sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
   curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
   curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
   sudo apt update && sudo apt install -y caddy
   ```

2. Copy TableTell's Caddy configuration:
   ```bash
   sudo cp deploy/Caddyfile /etc/caddy/Caddyfile
   # Edit /etc/caddy/Caddyfile and replace your-domain.com with your actual domain
   sudo nano /etc/caddy/Caddyfile
   sudo systemctl reload caddy
   ```

### B. Using Nginx + Certbot
If your VPS already runs Nginx:

1. Copy Nginx configuration:
   ```bash
   sudo cp deploy/nginx/tabletell.conf /etc/nginx/sites-available/tabletell
   # Replace your-domain.com with your domain
   sudo nano /etc/nginx/sites-available/tabletell

   sudo ln -s /etc/nginx/sites-available/tabletell /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl reload nginx
   ```

2. Provision free SSL certificate with Certbot:
   ```bash
   sudo apt install -y certbot python3-certbot-nginx
   sudo certbot --nginx -d your-domain.com
   ```

---

## ⚡ Critical Production Gotchas (Must Read for Engineer)

### 1. Server-Sent Events (SSE) Buffering
> [!IMPORTANT]
> TableTell streams real-time agent progression and SQL generation over `/api/chat/stream`.
> By default, standard Nginx configurations buffer HTTP responses in 4KB/8KB buffers. **If buffering is enabled, the browser will not receive live tokens until the entire query finishes.**
> 
> The provided [`deploy/nginx/tabletell.conf`](file:///d:/flagship%20project/Hobby%20Projects/TableTell/deploy/nginx/tabletell.conf) specifically configures:
> ```nginx
> location /api/chat/stream {
>     proxy_buffering off;
>     proxy_cache off;
>     chunked_transfer_encoding off;
>     proxy_read_timeout 600s;
> }
> ```
> In Caddy, this is handled via `flush_interval -1`.

### 2. Large Dataset Upload Limits
Default Nginx installations limit uploads to 1MB (`client_max_body_size`). TableTell's configuration increases this to `100M` to support large CSV and Excel datasets.

### 3. Persistent Volume Integrity
Ensure the `./data_lake` directory on the host VPS has read/write permissions for the container:
```bash
sudo chown -R 1000:1000 /opt/tabletell/data_lake
```

---

## 🩺 System Health Monitoring

TableTell includes a comprehensive health check endpoint:
```bash
curl http://localhost:8000/api/health
```

Example response:
```json
{
  "status": "healthy",
  "service": "TableTell API",
  "version": "2.0.0",
  "timestamp": "2026-10-24T15:30:00Z",
  "diagnostics": {
    "metadata_db": {
      "status": "connected",
      "datasets_count": 4,
      "db_path": "/app/backend/data_lake/metadata/tabletell_metadata.db"
    },
    "duckdb_engine": {
      "status": "ready",
      "in_memory_catalog": true
    },
    "storage": {
      "data_lake_size_mb": 14.2,
      "raw_files_count": 4,
      "processed_parquet_count": 4,
      "disk_free_gb": 42.8,
      "disk_total_gb": 80.0
    },
    "ai_engine": {
      "provider": "Google Gemini",
      "model": "gemini-2.5-flash",
      "api_key_configured": true
    }
  }
}
```

---

## 🛠 Option 2: Bare-Metal Host Deployment (Systemd)

If your engineer prefers running Python directly without Docker:

1. **Build Frontend**:
   ```bash
   cd /var/www/tabletell/frontend
   npm install && npm run build
   ```

2. **Setup Python Virtual Environment**:
   ```bash
   cd /var/www/tabletell/backend
   python3 -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   ```

3. **Install Systemd Service**:
   ```bash
   sudo cp deploy/tabletell.service /etc/systemd/system/
   sudo systemctl daemon-reload
   sudo systemctl enable --now tabletell
   sudo systemctl status tabletell
   ```
