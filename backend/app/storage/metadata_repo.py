"""
Metadata Repository for TableTell
Lightweight, thread-safe SQLite-backed persistence for datasets, versions,
cleaning plans, analytical runs, and audit logs.
"""

import sqlite3
import json
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, List, Optional
from app.core.config import settings


class MetadataRepository:
    def __init__(self, db_path: Optional[Path] = None):
        self.db_path = db_path or settings.METADATA_DB_PATH
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_db()

    @contextmanager
    def _get_connection(self):
        conn = sqlite3.connect(str(self.db_path), timeout=15.0)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL;")
        conn.execute("PRAGMA foreign_keys=ON;")
        try:
            with conn:
                yield conn
        finally:
            conn.close()

    def _init_db(self):
        """Initializes database schema if tables do not exist."""
        with self._get_connection() as conn:
            conn.executescript("""
                CREATE TABLE IF NOT EXISTS datasets (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    original_filename TEXT NOT NULL,
                    source_format TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    raw_storage_path TEXT,
                    current_version INTEGER NOT NULL DEFAULT 1,
                    description TEXT DEFAULT ''
                );

                CREATE TABLE IF NOT EXISTS dataset_versions (
                    id TEXT PRIMARY KEY,
                    dataset_id TEXT NOT NULL,
                    version INTEGER NOT NULL,
                    parent_version INTEGER,
                    created_at TEXT NOT NULL,
                    storage_path TEXT NOT NULL,
                    row_count INTEGER NOT NULL DEFAULT 0,
                    col_count INTEGER NOT NULL DEFAULT 0,
                    size_bytes INTEGER NOT NULL DEFAULT 0,
                    schema_json TEXT DEFAULT '{}',
                    profiling_json TEXT DEFAULT '{}',
                    quality_score INTEGER NOT NULL DEFAULT 100,
                    quality_report_json TEXT DEFAULT '{}',
                    changelog_json TEXT DEFAULT '[]',
                    is_ready INTEGER NOT NULL DEFAULT 1,
                    FOREIGN KEY (dataset_id) REFERENCES datasets(id) ON DELETE CASCADE,
                    UNIQUE(dataset_id, version)
                );

                CREATE TABLE IF NOT EXISTS cleaning_plans (
                    id TEXT PRIMARY KEY,
                    dataset_id TEXT NOT NULL,
                    source_version INTEGER NOT NULL,
                    created_at TEXT NOT NULL,
                    recommendations_json TEXT NOT NULL DEFAULT '[]',
                    status TEXT NOT NULL DEFAULT 'proposed',
                    FOREIGN KEY (dataset_id) REFERENCES datasets(id) ON DELETE CASCADE
                );

                CREATE TABLE IF NOT EXISTS analytical_runs (
                    id TEXT PRIMARY KEY,
                    dataset_id TEXT NOT NULL,
                    dataset_version INTEGER NOT NULL DEFAULT 1,
                    user_query TEXT NOT NULL,
                    generated_sql TEXT,
                    validation_status TEXT NOT NULL DEFAULT 'valid',
                    execution_duration_ms REAL DEFAULT 0.0,
                    row_count INTEGER DEFAULT 0,
                    columns_json TEXT DEFAULT '[]',
                    chart_spec_json TEXT,
                    summary_markdown TEXT,
                    error TEXT,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY (dataset_id) REFERENCES datasets(id) ON DELETE CASCADE
                );

                CREATE TABLE IF NOT EXISTS audit_logs (
                    id TEXT PRIMARY KEY,
                    entity_type TEXT NOT NULL,
                    entity_id TEXT NOT NULL,
                    action TEXT NOT NULL,
                    details_json TEXT DEFAULT '{}',
                    created_at TEXT NOT NULL
                );

                CREATE INDEX IF NOT EXISTS idx_versions_dataset ON dataset_versions(dataset_id);
                CREATE INDEX IF NOT EXISTS idx_runs_dataset ON analytical_runs(dataset_id);
                CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id);
            """)

    # -------------------------------------------------------------------------
    # Dataset Operations
    # -------------------------------------------------------------------------

    def create_dataset(
        self,
        dataset_id: str,
        name: str,
        original_filename: str,
        source_format: str,
        raw_storage_path: Optional[str] = None,
        description: str = "",
    ) -> Dict[str, Any]:
        now = datetime.now(timezone.utc).isoformat()
        with self._get_connection() as conn:
            conn.execute(
                """
                INSERT INTO datasets (id, name, original_filename, source_format, created_at, updated_at, raw_storage_path, current_version, description)
                VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
                ON CONFLICT(id) DO UPDATE SET
                    name=excluded.name,
                    updated_at=excluded.updated_at,
                    raw_storage_path=COALESCE(excluded.raw_storage_path, datasets.raw_storage_path),
                    description=excluded.description
                """,
                (dataset_id, name, original_filename, source_format, now, now, raw_storage_path, description)
            )
        self.record_audit("dataset", dataset_id, "create_dataset", {"name": name, "format": source_format})
        return self.get_dataset(dataset_id)

    def get_dataset(self, dataset_id: str) -> Optional[Dict[str, Any]]:
        with self._get_connection() as conn:
            row = conn.execute("SELECT * FROM datasets WHERE id = ?", (dataset_id,)).fetchone()
            if not row:
                return None
            res = dict(row)
            # Fetch current version info
            ver_row = conn.execute(
                "SELECT * FROM dataset_versions WHERE dataset_id = ? AND version = ?",
                (dataset_id, res["current_version"])
            ).fetchone()
            if ver_row:
                ver_dict = dict(ver_row)
                res["version_info"] = {
                    "version": ver_dict["version"],
                    "storage_path": ver_dict["storage_path"],
                    "row_count": ver_dict["row_count"],
                    "col_count": ver_dict["col_count"],
                    "size_bytes": ver_dict["size_bytes"],
                    "quality_score": ver_dict["quality_score"],
                    "schema": json.loads(ver_dict["schema_json"] or "{}"),
                    "profiling": json.loads(ver_dict["profiling_json"] or "{}"),
                    "quality_report": json.loads(ver_dict["quality_report_json"] or "{}"),
                    "changelog": json.loads(ver_dict["changelog_json"] or "[]"),
                }
            else:
                res["version_info"] = None
            return res

    def list_datasets(self) -> List[Dict[str, Any]]:
        with self._get_connection() as conn:
            rows = conn.execute("SELECT * FROM datasets ORDER BY updated_at DESC").fetchall()
            result = []
            for r in rows:
                d = dict(r)
                # Attach latest version stats
                ver = conn.execute(
                    "SELECT version, storage_path, row_count, col_count, size_bytes, quality_score FROM dataset_versions WHERE dataset_id = ? AND version = ?",
                    (d["id"], d["current_version"])
                ).fetchone()
                if ver:
                    v_dict = dict(ver)
                    d["row_count"] = v_dict["row_count"]
                    d["col_count"] = v_dict["col_count"]
                    d["size_bytes"] = v_dict["size_bytes"]
                    d["size_kb"] = round(v_dict["size_bytes"] / 1024.0, 1) if v_dict["size_bytes"] else 0.0
                    d["quality_score"] = v_dict["quality_score"]
                    d["storage_path"] = v_dict["storage_path"]
                else:
                    d["row_count"] = 0
                    d["col_count"] = 0
                    d["size_bytes"] = 0
                    d["size_kb"] = 0.0
                    d["quality_score"] = 100
                    d["storage_path"] = None
                result.append(d)
            return result

    def update_dataset_current_version(self, dataset_id: str, new_version: int):
        now = datetime.now(timezone.utc).isoformat()
        with self._get_connection() as conn:
            conn.execute(
                "UPDATE datasets SET current_version = ?, updated_at = ? WHERE id = ?",
                (new_version, now, dataset_id)
            )

    def delete_dataset(self, dataset_id: str) -> bool:
        """
        Deletes a dataset and cascades removal of all associated versions,
        cleaning plans, and analytical runs in SQLite.
        """
        with self._get_connection() as conn:
            row = conn.execute("SELECT id FROM datasets WHERE id = ?", (dataset_id,)).fetchone()
            if not row:
                return False
            conn.execute("DELETE FROM datasets WHERE id = ?", (dataset_id,))
        self.record_audit("dataset", dataset_id, "delete_dataset", {"deleted": True})
        return True


    # -------------------------------------------------------------------------
    # Dataset Version Operations
    # -------------------------------------------------------------------------

    def create_version(
        self,
        dataset_id: str,
        version: int,
        storage_path: str,
        row_count: int,
        col_count: int,
        size_bytes: int,
        schema: Optional[Dict[str, Any]] = None,
        profiling: Optional[Dict[str, Any]] = None,
        quality_score: int = 100,
        quality_report: Optional[Dict[str, Any]] = None,
        changelog: Optional[List[str]] = None,
        parent_version: Optional[int] = None,
    ) -> Dict[str, Any]:
        now = datetime.now(timezone.utc).isoformat()
        version_id = f"{dataset_id}_v{version}"
        schema_json = json.dumps(schema or {})
        prof_json = json.dumps(profiling or {})
        qual_json = json.dumps(quality_report or {})
        chan_json = json.dumps(changelog or [])

        with self._get_connection() as conn:
            conn.execute(
                """
                INSERT INTO dataset_versions (
                    id, dataset_id, version, parent_version, created_at, storage_path,
                    row_count, col_count, size_bytes, schema_json, profiling_json,
                    quality_score, quality_report_json, changelog_json, is_ready
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
                ON CONFLICT(id) DO UPDATE SET
                    storage_path=excluded.storage_path,
                    row_count=excluded.row_count,
                    col_count=excluded.col_count,
                    size_bytes=excluded.size_bytes,
                    schema_json=excluded.schema_json,
                    profiling_json=excluded.profiling_json,
                    quality_score=excluded.quality_score,
                    quality_report_json=excluded.quality_report_json,
                    changelog_json=excluded.changelog_json
                """,
                (
                    version_id, dataset_id, version, parent_version, now, storage_path,
                    row_count, col_count, size_bytes, schema_json, prof_json,
                    quality_score, qual_json, chan_json
                )
            )
            # Update dataset's current version
            conn.execute(
                "UPDATE datasets SET current_version = ?, updated_at = ? WHERE id = ?",
                (version, now, dataset_id)
            )

        self.record_audit("version", version_id, "create_version", {
            "dataset_id": dataset_id,
            "version": version,
            "row_count": row_count,
            "quality_score": quality_score
        })
        return self.get_version(dataset_id, version)

    def get_version(self, dataset_id: str, version: int) -> Optional[Dict[str, Any]]:
        with self._get_connection() as conn:
            row = conn.execute(
                "SELECT * FROM dataset_versions WHERE dataset_id = ? AND version = ?",
                (dataset_id, version)
            ).fetchone()
            if not row:
                return None
            res = dict(row)
            res["schema"] = json.loads(res["schema_json"] or "{}")
            res["profiling"] = json.loads(res["profiling_json"] or "{}")
            res["quality_report"] = json.loads(res["quality_report_json"] or "{}")
            res["changelog"] = json.loads(res["changelog_json"] or "[]")
            return res

    def list_versions(self, dataset_id: str) -> List[Dict[str, Any]]:
        with self._get_connection() as conn:
            rows = conn.execute(
                "SELECT * FROM dataset_versions WHERE dataset_id = ? ORDER BY version ASC",
                (dataset_id,)
            ).fetchall()
            results = []
            for r in rows:
                res = dict(r)
                res["schema"] = json.loads(res["schema_json"] or "{}")
                res["profiling"] = json.loads(res["profiling_json"] or "{}")
                res["quality_report"] = json.loads(res["quality_report_json"] or "{}")
                res["changelog"] = json.loads(res["changelog_json"] or "[]")
                results.append(res)
            return results

    # -------------------------------------------------------------------------
    # Cleaning Plans Operations
    # -------------------------------------------------------------------------

    def save_cleaning_plan(
        self,
        plan_id: str,
        dataset_id: str,
        source_version: int,
        recommendations: List[Dict[str, Any]],
        status: str = "proposed",
    ) -> Dict[str, Any]:
        now = datetime.now(timezone.utc).isoformat()
        rec_json = json.dumps(recommendations)
        with self._get_connection() as conn:
            conn.execute(
                """
                INSERT INTO cleaning_plans (id, dataset_id, source_version, created_at, recommendations_json, status)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    recommendations_json=excluded.recommendations_json,
                    status=excluded.status
                """,
                (plan_id, dataset_id, source_version, now, rec_json, status)
            )
        self.record_audit("cleaning_plan", plan_id, "save_plan", {"dataset_id": dataset_id, "count": len(recommendations)})
        return self.get_cleaning_plan(plan_id)

    def get_cleaning_plan(self, plan_id: str) -> Optional[Dict[str, Any]]:
        with self._get_connection() as conn:
            row = conn.execute("SELECT * FROM cleaning_plans WHERE id = ?", (plan_id,)).fetchone()
            if not row:
                return None
            res = dict(row)
            res["recommendations"] = json.loads(res["recommendations_json"] or "[]")
            return res

    def update_cleaning_plan_status(self, plan_id: str, status: str):
        with self._get_connection() as conn:
            conn.execute("UPDATE cleaning_plans SET status = ? WHERE id = ?", (status, plan_id))

    # -------------------------------------------------------------------------
    # Analytical Runs Operations
    # -------------------------------------------------------------------------

    def record_analytical_run(
        self,
        run_id: str,
        dataset_id: str,
        dataset_version: int,
        user_query: str,
        generated_sql: Optional[str] = None,
        validation_status: str = "valid",
        execution_duration_ms: float = 0.0,
        row_count: int = 0,
        columns: Optional[List[str]] = None,
        chart_spec: Optional[Dict[str, Any]] = None,
        summary_markdown: Optional[str] = None,
        error: Optional[str] = None,
    ) -> Dict[str, Any]:
        now = datetime.now(timezone.utc).isoformat()
        cols_json = json.dumps(columns or [])
        chart_json = json.dumps(chart_spec) if chart_spec else None

        with self._get_connection() as conn:
            conn.execute(
                """
                INSERT INTO analytical_runs (
                    id, dataset_id, dataset_version, user_query, generated_sql,
                    validation_status, execution_duration_ms, row_count, columns_json,
                    chart_spec_json, summary_markdown, error, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    run_id, dataset_id, dataset_version, user_query, generated_sql,
                    validation_status, execution_duration_ms, row_count, cols_json,
                    chart_json, summary_markdown, error, now
                )
            )
        return self.get_analytical_run(run_id)

    def get_analytical_run(self, run_id: str) -> Optional[Dict[str, Any]]:
        with self._get_connection() as conn:
            row = conn.execute("SELECT * FROM analytical_runs WHERE id = ?", (run_id,)).fetchone()
            if not row:
                return None
            res = dict(row)
            res["columns"] = json.loads(res["columns_json"] or "[]")
            res["chart_spec"] = json.loads(res["chart_spec_json"]) if res["chart_spec_json"] else None
            return res

    def list_analytical_runs(self, dataset_id: Optional[str] = None, limit: int = 50) -> List[Dict[str, Any]]:
        with self._get_connection() as conn:
            if dataset_id:
                rows = conn.execute(
                    "SELECT * FROM analytical_runs WHERE dataset_id = ? ORDER BY created_at DESC LIMIT ?",
                    (dataset_id, limit)
                ).fetchall()
            else:
                rows = conn.execute(
                    "SELECT * FROM analytical_runs ORDER BY created_at DESC LIMIT ?",
                    (limit,)
                ).fetchall()
            results = []
            for r in rows:
                res = dict(r)
                res["columns"] = json.loads(res["columns_json"] or "[]")
                res["chart_spec"] = json.loads(res["chart_spec_json"]) if res["chart_spec_json"] else None
                results.append(res)
            return results

    # -------------------------------------------------------------------------
    # Audit Logs
    # -------------------------------------------------------------------------

    def record_audit(self, entity_type: str, entity_id: str, action: str, details: Optional[Dict[str, Any]] = None):
        import uuid
        now = datetime.now(timezone.utc).isoformat()
        audit_id = f"aud_{uuid.uuid4().hex[:12]}"
        with self._get_connection() as conn:
            conn.execute(
                "INSERT INTO audit_logs (id, entity_type, entity_id, action, details_json, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                (audit_id, entity_type, entity_id, action, json.dumps(details or {}), now)
            )

    def list_audit_logs(self, limit: int = 100) -> List[Dict[str, Any]]:
        with self._get_connection() as conn:
            rows = conn.execute("SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT ?", (limit,)).fetchall()
            res = []
            for r in rows:
                item = dict(r)
                item["details"] = json.loads(item["details_json"] or "{}")
                res.append(item)
            return res


metadata_repo = MetadataRepository()
