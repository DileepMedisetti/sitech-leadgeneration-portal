from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.db.database import engine
from app.routes.analytics import router as analytics_router
from app.routes.audience import router as audience_router
from app.routes.auth import router as auth_router
from app.routes.campaigns import router as campaigns_router
from app.routes.dashboard import router as dashboard_router
from app.routes.deliverability import router as deliverability_router
from app.routes.email_accounts import router as email_accounts_router
from app.routes.lead_extraction import router as lead_extraction_router
from app.routes.leads import router as leads_router
from app.routes.review_queue import router as review_queue_router
from app.routes.search_collection import router as search_collection_router
from app.routes.search_jobs import router as search_jobs_router
from app.routes.settings import router as settings_router
from app.commands.bootstrap import bootstrap_demo_user

app = FastAPI(
    title="Sitech Series — Lead Intelligence Portal",
    description="API for academic lead discovery, accurate contact extraction, qualification, and campaign deliverability.",
    version="2.1.0",
)


@app.on_event("startup")
def on_app_startup():
    """Ensure initial demo user and default sender exist on application startup."""
    try:
        bootstrap_demo_user()
    except Exception as exc:
        print(f"Warning: Demo user bootstrap warning: {exc}")


# Enable CORS for frontend applications
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
        "*",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routes
app.include_router(auth_router)
app.include_router(email_accounts_router)
app.include_router(dashboard_router)
app.include_router(audience_router)
app.include_router(campaigns_router)
app.include_router(deliverability_router)
app.include_router(leads_router)
app.include_router(search_jobs_router)
app.include_router(search_collection_router)
app.include_router(lead_extraction_router)
app.include_router(review_queue_router)
app.include_router(analytics_router)
app.include_router(settings_router)


@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "Sitech Series Lead Intelligence API",
        "version": "2.1.0",
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
