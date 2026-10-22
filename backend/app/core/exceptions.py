"""
Domain and API exceptions for TableTell.
"""

from typing import Optional, Dict, Any


class TableTellException(Exception):
    """Base exception for all TableTell domain errors."""
    def __init__(self, message: str, status_code: int = 500, details: Optional[Dict[str, Any]] = None):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.details = details or {}


class DatasetNotFoundError(TableTellException):
    def __init__(self, dataset_id: str):
        super().__init__(f"Dataset '{dataset_id}' not found.", status_code=404)
        self.dataset_id = dataset_id


class DatasetVersionNotFoundError(TableTellException):
    def __init__(self, dataset_id: str, version: int):
        super().__init__(f"Version {version} not found for dataset '{dataset_id}'.", status_code=404)
        self.dataset_id = dataset_id
        self.version = version


class InvalidFileError(TableTellException):
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(message, status_code=400, details=details)


class FileTooLargeError(TableTellException):
    def __init__(self, file_size_mb: float, max_mb: int):
        super().__init__(
            f"Uploaded file size ({file_size_mb:.2f} MB) exceeds maximum permitted limit ({max_mb} MB).",
            status_code=413,
            details={"file_size_mb": file_size_mb, "max_mb": max_mb}
        )


class UnsafeSQLError(TableTellException):
    def __init__(self, message: str, sql: Optional[str] = None):
        super().__init__(f"Unsafe or unauthorized SQL query: {message}", status_code=400, details={"sql": sql})
        self.sql = sql


class QueryExecutionError(TableTellException):
    def __init__(self, message: str, sql: Optional[str] = None):
        super().__init__(f"Query execution failed: {message}", status_code=500, details={"sql": sql})
        self.sql = sql


class CleaningPlanError(TableTellException):
    def __init__(self, message: str):
        super().__init__(message, status_code=400)
