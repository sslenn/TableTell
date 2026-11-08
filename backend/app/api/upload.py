"""
API endpoint for Dataset Ingestion & File Upload.
Preserves raw uploads and generates high-performance Parquet format.
Enforces bounded memory read (MAX_UPLOAD_SIZE_MB) and per-user ownership scoping.
"""

from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends, status
from typing import Optional, Dict, Any
from app.core.config import settings
from app.core.auth import get_current_user, AuthenticatedUser
from app.services.dataset_service import dataset_service
from app.core.exceptions import TableTellException

router = APIRouter(prefix="/datasets", tags=["Datasets & Ingestion"])


@router.post("/upload")
@router.post("")
async def upload_dataset(
    file: UploadFile = File(...),
    dataset_name: Optional[str] = Form(None),
    current_user: AuthenticatedUser = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Ingests an uploaded CSV, Excel (.xlsx/.xls), or Parquet file.
    Enforces MAX_UPLOAD_SIZE_MB before reading into memory, preserves immutable raw file
    in data_lake/raw/, standardizes headers, and produces version 1 compressed columnar
    Parquet in data_lake/processed/.
    """
    max_bytes = int(settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024)
    try:
        content = await file.read(max_bytes + 1)
        if not content:
            raise HTTPException(status_code=400, detail="Uploaded file is empty.")
        if len(content) > max_bytes:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"Uploaded file exceeds maximum allowed size of {settings.MAX_UPLOAD_SIZE_MB} MB."
            )

        owner_id = current_user.user_id if current_user and current_user.user_id not in ("local_analyst", "guest_analyst") else "public"
        result = dataset_service.upload_dataset(
            file_content=content,
            filename=file.filename or "uploaded_data.csv",
            custom_name=dataset_name,
            owner_id=owner_id
        )

        return {
            "status": "success",
            "message": f"Successfully ingested {file.filename} as '{result['dataset_id']}'",
            "data": result
        }
    except HTTPException:
        raise
    except TableTellException as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ingestion failed: {str(e)}")
