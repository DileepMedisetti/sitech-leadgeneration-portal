
from fastapi import FastAPI, HTTPException
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from app.db.database import engine
from app.routes.leads import router as leads_router
from app.routes.search_jobs import router as search_jobs_router
from app.routes.search_collection import router as search_collection_router
from app.routes.lead_extraction import router as lead_extraction_router

app = FastAPI(
    title="Sitech Series Lead Generation Portal",
    description="API for discovering, qualifying, and managing leads.",
    version="1.0.0",
)

app.include_router(leads_router)
app.include_router(search_jobs_router)
app.include_router(search_collection_router)
app.include_router(lead_extraction_router)

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "message": "Sitech Lead Generation API is running.",
    }

@app.get("/health/db")
def database_health_check():
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))

        return {
            "status": "healthy",
            "database": "connected",
        }

    except SQLAlchemyError:
        raise HTTPException(
            status_code=503,
            detail={
                "status": "unhealthy",
                "database": "disconnected",
            },
        )