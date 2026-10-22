"""
API endpoint for Dataset Ingestion & File Upload.
Preserves raw uploads and generates high-performance Parquet format.
"""

from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from typing import Optional, Dict, Any
from app.services.dataset_service import dataset_service
from app.core.exceptions import TableTellException

router = APIRouter(prefix="/datasets", tags=["Datasets & Ingestion"])


@router.post("/upload")
@router.post("")
async def upload_dataset(
    file: UploadFile = File(...),
    dataset_name: Optional[str] = Form(None)
) -> Dict[str, Any]:
    """
    Ingests an uploaded CSV, Excel (.xlsx/.xls), or Parquet file.
    Preserves immutable raw file in data_lake/raw/, standardizes headers,
    and produces version 1 compressed columnar Parquet in data_lake/processed/.
    """
    try:
        content = await file.read()
        if not content:
            raise HTTPException(status_code=400, detail="Uploaded file is empty.")

        result = dataset_service.upload_dataset(
            file_content=content,
            filename=file.filename or "uploaded_data.csv",
            custom_name=dataset_name
        )

        return {
            "status": "success",
            "message": f"Successfully ingested {file.filename} as '{result['dataset_id']}'",
            "data": result
        }
    except TableTellException as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ingestion failed: {str(e)}")
