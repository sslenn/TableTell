"""
SQL Safety and Read-Only Validation for TableTell.
Guarantees zero unauthorized mutations, DDL, DML, or host filesystem/secret access.
"""

import re
from typing import List, Optional
from app.core.exceptions import UnsafeSQLError

# Blacklisted SQL keywords and DuckDB table functions that mutate data, alter schema, or access the filesystem/env
FORBIDDEN_KEYWORDS = {
    "DROP", "DELETE", "INSERT", "UPDATE", "ALTER", "TRUNCATE",
    "CREATE", "REPLACE", "ATTACH", "DETACH", "COPY", "EXPORT",
    "IMPORT", "INSTALL", "LOAD", "PRAGMA", "CALL", "EXEC",
    "EXECUTE", "SYSTEM", "SET", "RESET",
    # DuckDB file & replacement scan functions
    "READ_CSV", "READ_CSV_AUTO", "READ_PARQUET", "PARQUET_SCAN",
    "READ_JSON", "READ_JSON_AUTO", "READ_JSON_OBJECTS", "READ_NDJSON", "READ_NDJSON_AUTO",
    "READ_TEXT", "READ_BLOB", "READ_XLSX", "WRITE_CSV", "WRITE_PARQUET",
    "SQLITE_SCAN", "POSTGRES_SCAN", "MYSQL_SCAN", "ICEBERG_SCAN", "DELTA_SCAN",
    "GLOB", "LIST_FILES",
    # DuckDB internal system/secret inspection functions
    "DUCKDB_SETTINGS", "DUCKDB_SECRETS", "DUCKDB_EXTENSIONS",
    "DUCKDB_DATABASES", "DUCKDB_TEMPORARY_FILES", "CURRENT_SETTING", "GETENV"
}

# Disallow direct string-literal replacement scans in FROM / JOIN clauses (e.g., SELECT * FROM '/etc/passwd')
_STRING_TABLE_SCAN_RE = re.compile(
    r"\b(?:FROM|JOIN)\s+'[^']+'",
    flags=re.IGNORECASE
)


def validate_read_only_sql(sql_query: str, allowed_table_names: Optional[List[str]] = None) -> str:
    """
    Validates that a SQL query is strictly read-only (SELECT / WITH).
    Rejects any statement containing forbidden DDL/DML/filesystem tokens or replacement file scans.
    """
    cleaned = sql_query.strip()
    if not cleaned:
        raise UnsafeSQLError("SQL query is empty.")

    # Remove single line and multi-line comments before analysis
    no_comments = re.sub(r"--.*?$", "", cleaned, flags=re.MULTILINE)
    no_comments = re.sub(r"/\*.*?\*/", "", no_comments, flags=re.DOTALL).strip()

    # Must start with SELECT, WITH, DESCRIBE, or EXPLAIN
    first_token_match = re.match(r"^([a-zA-Z]+)", no_comments)
    if not first_token_match:
        raise UnsafeSQLError("Query must begin with SELECT or WITH.", sql=cleaned)

    first_token = first_token_match.group(1).upper()
    if first_token not in {"SELECT", "WITH", "DESCRIBE", "EXPLAIN"}:
        raise UnsafeSQLError(
            f"Only read-only SELECT or WITH statements are allowed (attempted: {first_token}).",
            sql=cleaned
        )

    # Reject string-literal file replacement scans (e.g. FROM '/app/backend/.env')
    if _STRING_TABLE_SCAN_RE.search(no_comments):
        raise UnsafeSQLError(
            "Direct file path scans in FROM/JOIN clauses are prohibited.",
            sql=cleaned
        )

    # Strip single-quoted string literals before keyword tokenization so legitimate filter values
    # like WHERE status = 'set' do not false-positive on SET, while function calls outside quotes are caught.
    unquoted = re.sub(r"'[^']*'", "''", no_comments)

    tokens = re.findall(r"\b([a-zA-Z_]+)\b", unquoted)
    upper_tokens = {t.upper() for t in tokens}

    # Check against forbidden keywords
    violations = upper_tokens.intersection(FORBIDDEN_KEYWORDS)
    if violations:
        raise UnsafeSQLError(
            f"Query contains forbidden SQL operation(s): {', '.join(sorted(violations))}",
            sql=cleaned
        )

    # Disallow multiple semicolons/statements to prevent SQL injection chaining
    semicolons = no_comments.count(";")
    if semicolons > 1 or (semicolons == 1 and not no_comments.endswith(";")):
        raise UnsafeSQLError("Query chaining with multiple statements is prohibited.", sql=cleaned)

    return cleaned.rstrip(";")
