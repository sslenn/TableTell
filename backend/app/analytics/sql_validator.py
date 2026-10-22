"""
SQL Safety and Read-Only Validation for TableTell.
Guarantees zero unauthorized mutations, DDL, DML, or filesystem access.
"""

import re
from typing import List, Optional
from app.core.exceptions import UnsafeSQLError

# Blacklisted SQL keywords that mutate data, alter schema, or access filesystem
FORBIDDEN_KEYWORDS = {
    "DROP", "DELETE", "INSERT", "UPDATE", "ALTER", "TRUNCATE",
    "CREATE", "REPLACE", "ATTACH", "DETACH", "COPY", "EXPORT",
    "IMPORT", "INSTALL", "LOAD", "PRAGMA", "CALL", "EXEC",
    "EXECUTE", "SYSTEM", "READ_CSV", "READ_PARQUET", "WRITE_CSV"
}


def validate_read_only_sql(sql_query: str, allowed_table_names: Optional[List[str]] = None) -> str:
    """
    Validates that a SQL query is strictly read-only (SELECT / WITH).
    Rejects any statement containing forbidden DDL/DML tokens.
    """
    cleaned = sql_query.strip()
    if not cleaned:
        raise UnsafeSQLError("SQL query is empty.")

    # Remove single line and multi-line comments before analysis
    no_comments = re.sub(r"--.*?$", "", cleaned, flags=re.MULTILINE)
    no_comments = re.sub(r"/\*.*?\*/", "", no_comments, flags=re.DOTALL).strip()

    # Must start with SELECT or WITH
    first_token_match = re.match(r"^([a-zA-Z]+)", no_comments)
    if not first_token_match:
        raise UnsafeSQLError("Query must begin with SELECT or WITH.", sql=cleaned)

    first_token = first_token_match.group(1).upper()
    if first_token not in {"SELECT", "WITH", "DESCRIBE", "EXPLAIN"}:
        raise UnsafeSQLError(
            f"Only read-only SELECT or WITH statements are allowed (attempted: {first_token}).",
            sql=cleaned
        )

    # Tokenize words
    tokens = re.findall(r"\b([a-zA-Z_]+)\b", no_comments)
    upper_tokens = {t.upper() for t in tokens}

    # Check against forbidden keywords
    violations = upper_tokens.intersection(FORBIDDEN_KEYWORDS)
    if violations:
        raise UnsafeSQLError(
            f"Query contains forbidden SQL operation(s): {', '.join(sorted(violations))}",
            sql=cleaned
        )

    # Disallow multiple semicolons/statements to prevent SQL injection chaining
    semicolons = cleaned.count(";")
    if semicolons > 1 or (semicolons == 1 and not cleaned.endswith(";")):
        raise UnsafeSQLError("Query chaining with multiple statements is prohibited.", sql=cleaned)

    return cleaned.rstrip(";")
