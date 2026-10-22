"""
File validation for uploaded datasets.
"""

from pathlib import Path
from app.core.config import settings
from app.core.exceptions import InvalidFileError, FileTooLargeError

ALLOWED_EXTENSIONS = {".csv", ".parquet", ".xlsx", ".xls"}


def validate_upload_file(filename: str, file_size_bytes: int):
    """Validates uploaded file size and extension."""
    if not filename:
        raise InvalidFileError("Uploaded file must have a valid filename.")

    ext = Path(filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise InvalidFileError(
            f"Unsupported file format '{ext}'. Allowed formats: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
        )

    max_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
    if file_size_bytes > max_bytes:
        raise FileTooLargeError(
            file_size_mb=file_size_bytes / (1024 * 1024),
            max_mb=settings.MAX_UPLOAD_SIZE_MB
        )
