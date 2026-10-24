import os
import uvicorn

if __name__ == "__main__":
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8000"))
    is_dev = os.getenv("ENVIRONMENT", "development").lower() == "development"
    uvicorn.run("app.main:app", host=host, port=port, reload=is_dev)
