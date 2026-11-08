# 🛡️ TableTell Production Security Audit & Hardening Matrix

**Audit Date**: November 2026  
**Target Scope**: TableTell Full-Stack Analytical Platform (React 19 Frontend + FastAPI Backend + DuckDB + LangGraph Agent)  
**Standard Compliance**: OWASP Top 10 (2025/2026), OWASP API Security Top 10, OWASP LLM Top 10  

---

## Executive Summary

TableTell utilizes a high-performance **in-process analytical architecture** where DuckDB executes SQL queries directly against Parquet files in local storage (`data_lake/`). Because an LLM (LangGraph) generates executable SQL on demand and users can upload arbitrary CSV files, the application's attack surface centers on:
1. **SQL Injection & Sandbox Escape** (DuckDB filesystem reads)
2. **LLM Indirect Prompt Injection & Financial/Token Exhaustion** (API key burn)
3. **Authentication & Session Impersonation** (Clerk JWT handling)
4. **File Ingestion & Path Traversal** (Malicious CSV/Parquet uploads)
5. **Infrastructure & Network Exposure** (CORS, Reverse Proxy, Docker permissions)

Overall Security Rating: **A- (Strong Foundation with 5 Production Hardening Directives)**.

---

## Audit Findings & Verification Status

### 1. SQL & In-Process DuckDB Sandbox
* **Status**: 🟢 **PASSED (Defended)**
* **Assessment**:
  - `backend/app/analytics/sql_validator.py` enforces strict AST/regex token filtering:
    - **Whitelist**: Only statements beginning with `SELECT`, `WITH`, `DESCRIBE`, or `EXPLAIN` are permitted.
    - **Blacklist**: Explicitly blocks all DDL/DML (`DROP`, `DELETE`, `UPDATE`, `INSERT`, `ALTER`, `TRUNCATE`, `CREATE`, `REPLACE`, `ATTACH`, `DETACH`, `COPY`, `EXPORT`, `IMPORT`, `SET`, `PRAGMA`).
    - **Filesystem Read Blocker**: Blocks DuckDB replacement scans and file functions (`READ_CSV`, `READ_PARQUET`, `READ_JSON`, `READ_TEXT`, `GLOB`, `LIST_FILES`, `GETENV`, `DUCKDB_SETTINGS`, `DUCKDB_SECRETS`).
    - **Path Literal Rejection**: Blocks `FROM '/path'` and `JOIN '/path'` syntax.
  - `backend/app/analytics/executor.py` applies DuckDB connection jailing:
    ```sql
    SET allowed_directories = ['/path/to/data_lake'];
    SET lock_configuration = true;
    ```
    This prevents an attacker from reading `/etc/passwd`, `.env`, or server code even if SQL validation were bypassed.

---

### 2. LLM, Quota Enforcement & BYOK Protection
* **Status**: 🟢 **PASSED (Defended)**
* **Assessment**:
  - TableTell implements a daily quota meter (20 free queries/day per client) stored in SQLite (`daily_usage`).
  - When the quota is reached, the app refuses server-funded LLM inference and prompts the user for Bring-Your-Own-Key (`X-Custom-AI-Key`).
  - The draggable statistics assistant includes a deterministic offline statistics encyclopedia fallback so quota limits never cause server 500 errors.
* **Production Recommendation**:
  - **Client Fingerprint Spoofing**: `X-Client-Id` is generated in browser `localStorage`. A technical user could cycle client IDs to reset the 20-query limit.
  - **Fix**: In production, the backend rate limiter must combine `X-Client-Id` with the trusted IP from `request.headers.get("x-real-ip")` provided by Nginx/Caddy.

---

### 3. Authentication & JWT Governance (Clerk)
* **Status**: 🟢 **PASSED (Defended)**
* **Assessment**:
  - `backend/app/core/auth.py` validates JWT Bearer tokens using Clerk's public JWKS (`.well-known/jwks.json`).
  - Derives canonical issuers strictly from server settings or publishable keys (`pk_test_...` / `pk_live_...`), preventing attacker-controlled `iss` forgery or SSRF.
  - Development bypass is strictly gated behind `ENVIRONMENT != 'production'`. In production, missing or forged tokens return `401 Unauthorized`.
* **Production Recommendation**:
  - Ensure `.env` sets `ENVIRONMENT=production`. When `production` is set, FastAPI automatically disables `/docs`, `/redoc`, and `/openapi.json`.

---

### 4. File Upload Ingestion & Storage Security
* **Status**: 🟡 **ACTION REQUIRED (Medium Priority)**
* **Assessment**:
  - `backend/app/storage/parquet_store.py` uses `sanitize_id()` with `re.sub(r"[^a-zA-Z0-9_\-]", "", dataset_id)` to eliminate path traversal (`../`) attacks.
  - Upload size is capped at 100MB (`MAX_UPLOAD_SIZE_MB`).
* **Production Recommendation**:
  - **Magic-Byte Sniffing**: Inspect incoming upload file bytes (e.g. check for valid CSV/UTF-8 headers or Parquet `PAR1` magic bytes) to ensure attackers cannot upload scripts disguised as `.csv`.
  - **CSV Formula Injection**: When exporting cleaned data or reports, sanitize cells starting with `=`, `+`, `-`, or `@` to prevent spreadsheet command execution in Excel.

---

### 5. Network, CORS & Container Isolation
* **Status**: 🟡 **ACTION REQUIRED (Low Priority)**
* **Assessment**:
  - FastAPI is configured with `CORSMiddleware`.
  - Nginx and Caddy reverse proxy templates in `deploy/` include SSE unbuffering for LangGraph real-time token streaming.
* **Production Recommendation**:
  - **CORS Restriction**: Do not leave `CORS_ORIGINS=["*"]` in production. Pin `CORS_ORIGINS` to your production domain (e.g., `https://tabletell.app`).
  - **Docker Non-Root User**: In `Dockerfile`, add a dedicated non-root Linux user (`USER appuser`) so that container processes do not run as root.

---

## Action Plan Checklist for Production Deployment

| Priority | Area | Recommendation | Implementation Effort |
|:---:|:---|:---|:---:|
| **P0** | **Environment** | Set `ENVIRONMENT=production` in VPS `.env` to disable Swagger `/docs` and enforce Clerk JWT. | 2 mins |
| **P1** | **CORS** | Set `CORS_ORIGINS="https://yourdomain.com"` in `.env` instead of wildcard. | 2 mins |
| **P1** | **Rate Limiting** | Ensure Nginx passes `$remote_addr` as `X-Real-IP` so clients cannot bypass quota via UUID rotation. | 5 mins |
| **P2** | **Docker** | Switch container runtime to non-root `USER 1000:1000`. | 10 mins |
| **P2** | **Uploads** | Validate file magic bytes (`PAR1` for Parquet, valid UTF-8 for CSV) before ingestion. | 15 mins |

---

## Summary Verdict for CV Portfolio
Your architecture is already significantly more secure than typical portfolio projects:
- You have **AST-based SQL validation** and **DuckDB file sandboxing** preventing filesystem exfiltration.
- You have **BYOK + Quota controls** shielding you from cloud cost spikes.
- You have **pinned JWKS Clerk validation** preventing token spoofing.

Setting `ENVIRONMENT=production` and configuring your reverse proxy makes TableTell enterprise-ready for public recruiter demos.
