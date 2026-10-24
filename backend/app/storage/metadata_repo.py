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

                CREATE TABLE IF NOT EXISTS assistant_conversations (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    model TEXT NOT NULL DEFAULT 'gemini-2.5-flash',
                    is_archived INTEGER NOT NULL DEFAULT 0
                );

                CREATE TABLE IF NOT EXISTS assistant_messages (
                    id TEXT PRIMARY KEY,
                    conversation_id TEXT NOT NULL,
                    role TEXT NOT NULL,
                    content TEXT NOT NULL,
                    tokens_used INTEGER DEFAULT 0,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY (conversation_id) REFERENCES assistant_conversations(id) ON DELETE CASCADE
                );

                CREATE INDEX IF NOT EXISTS idx_versions_dataset ON dataset_versions(dataset_id);
                CREATE INDEX IF NOT EXISTS idx_runs_dataset ON analytical_runs(dataset_id);
                CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id);
                CREATE INDEX IF NOT EXISTS idx_assistant_messages_conv ON assistant_messages(conversation_id, created_at);
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

    def rename_dataset(
        self,
        old_dataset_id: str,
        new_dataset_id: str,
        new_name: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Renames a dataset and updates all foreign key references in dataset_versions,
        cleaning_plans, analytical_runs, and audit_logs in SQLite.
        """
        old = self.get_dataset(old_dataset_id)
        if not old:
            raise ValueError(f"Dataset '{old_dataset_id}' not found")

        now = datetime.now(timezone.utc).isoformat()
        with self._get_connection() as conn:
            existing = conn.execute("SELECT id FROM datasets WHERE id = ?", (new_dataset_id,)).fetchone()
            if existing:
                raise ValueError(f"A dataset with id '{new_dataset_id}' already exists")

            conn.execute("PRAGMA foreign_keys=OFF;")
            try:
                # 1. Update datasets table
                old_raw_path = old.get("raw_storage_path") or ""
                new_raw_path = old_raw_path
                if old_raw_path:
                    new_raw_path = old_raw_path.replace(f"/{old_dataset_id}.", f"/{new_dataset_id}.").replace(f"\\{old_dataset_id}.", f"\\{new_dataset_id}.")

                display_name = new_name or new_dataset_id.replace("_", " ").title()
                orig_filename = old.get("original_filename") or f"{old_dataset_id}.parquet"
                new_orig_filename = orig_filename
                if orig_filename.startswith(old_dataset_id):
                    new_orig_filename = orig_filename.replace(old_dataset_id, new_dataset_id, 1)

                conn.execute(
                    """
                    UPDATE datasets
                    SET id = ?, name = ?, original_filename = ?, raw_storage_path = ?, updated_at = ?
                    WHERE id = ?
                    """,
                    (new_dataset_id, display_name, new_orig_filename, new_raw_path, now, old_dataset_id)
                )

                # 2. Update dataset_versions table
                versions = conn.execute(
                    "SELECT id, version, storage_path FROM dataset_versions WHERE dataset_id = ?",
                    (old_dataset_id,)
                ).fetchall()

                for v in versions:
                    old_ver_id = v["id"]
                    ver_num = v["version"]
                    new_ver_id = f"{new_dataset_id}_v{ver_num}"
                    old_sp = v["storage_path"] or ""
                    new_sp = old_sp.replace(f"{old_dataset_id}_v{ver_num}", f"{new_dataset_id}_v{ver_num}").replace(f"{old_dataset_id}.parquet", f"{new_dataset_id}.parquet")

                    conn.execute(
                        """
                        UPDATE dataset_versions
                        SET id = ?, dataset_id = ?, storage_path = ?
                        WHERE id = ?
                        """,
                        (new_ver_id, new_dataset_id, new_sp, old_ver_id)
                    )

                # 3. Update cleaning_plans table
                conn.execute(
                    "UPDATE cleaning_plans SET dataset_id = ? WHERE dataset_id = ?",
                    (new_dataset_id, old_dataset_id)
                )

                # 4. Update analytical_runs table
                conn.execute(
                    "UPDATE analytical_runs SET dataset_id = ? WHERE dataset_id = ?",
                    (new_dataset_id, old_dataset_id)
                )

                # 5. Update audit_logs table
                conn.execute(
                    "UPDATE audit_logs SET entity_id = ? WHERE entity_type = 'dataset' AND entity_id = ?",
                    (new_dataset_id, old_dataset_id)
                )

                # Verify foreign key integrity
                fk_violations = conn.execute("PRAGMA foreign_key_check;").fetchall()
                if fk_violations:
                    raise sqlite3.IntegrityError(f"Foreign key check failed after renaming dataset: {fk_violations}")

            finally:
                conn.execute("PRAGMA foreign_keys=ON;")

        self.record_audit("dataset", new_dataset_id, "rename_dataset", {"old_id": old_dataset_id, "new_id": new_dataset_id})
        return self.get_dataset(new_dataset_id)


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

    # -------------------------------------------------------------------------
    # AI Assistant Operations
    # -------------------------------------------------------------------------

    def get_or_create_default_conversation(self) -> Dict[str, Any]:
        """Returns or creates the default persistent conversation for the assistant."""
        with self._get_connection() as conn:
            row = conn.execute("SELECT * FROM assistant_conversations WHERE is_archived = 0 ORDER BY updated_at DESC LIMIT 1").fetchone()
            if row:
                return dict(row)
            
            # Create default conversation
            import uuid
            conv_id = f"conv_{uuid.uuid4().hex[:10]}"
            now = datetime.now(timezone.utc).isoformat()
            conn.execute(
                "INSERT INTO assistant_conversations (id, title, created_at, updated_at, model) VALUES (?, ?, ?, ?, ?)",
                (conv_id, "TableTell Copilot", now, now, "gemini-2.5-flash")
            )
            return {
                "id": conv_id,
                "title": "TableTell Copilot",
                "created_at": now,
                "updated_at": now,
                "model": "gemini-2.5-flash",
                "is_archived": 0
            }

    def save_assistant_message(
        self,
        conversation_id: str,
        role: str,
        content: str,
        tokens_used: int = 0
    ) -> Dict[str, Any]:
        """Saves a message to the assistant thread and updates conversation timestamp."""
        import uuid
        msg_id = f"msg_{uuid.uuid4().hex[:12]}"
        now = datetime.now(timezone.utc).isoformat()
        with self._get_connection() as conn:
            conn.execute(
                "INSERT INTO assistant_messages (id, conversation_id, role, content, tokens_used, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                (msg_id, conversation_id, role, content, tokens_used, now)
            )
            conn.execute(
                "UPDATE assistant_conversations SET updated_at = ? WHERE id = ?",
                (now, conversation_id)
            )
        return {
            "id": msg_id,
            "conversation_id": conversation_id,
            "role": role,
            "content": content,
            "tokens_used": tokens_used,
            "created_at": now
        }

    def list_assistant_messages(self, conversation_id: str, limit: int = 50) -> List[Dict[str, Any]]:
        """Retrieves messages for an assistant conversation in chronological order."""
        with self._get_connection() as conn:
            rows = conn.execute(
                "SELECT * FROM assistant_messages WHERE conversation_id = ? ORDER BY created_at ASC LIMIT ?",
                (conversation_id, limit)
            ).fetchall()
            return [dict(r) for r in rows]

    def clear_assistant_history(self, conversation_id: str) -> None:
        """Clears all messages within an assistant conversation thread."""
        now = datetime.now(timezone.utc).isoformat()
        with self._get_connection() as conn:
            conn.execute("DELETE FROM assistant_messages WHERE conversation_id = ?", (conversation_id,))
            conn.execute("UPDATE assistant_conversations SET updated_at = ? WHERE id = ?", (now, conversation_id))


metadata_repo = MetadataRepository()
