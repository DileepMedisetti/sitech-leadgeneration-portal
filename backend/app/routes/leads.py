
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.schemas.lead import (
    LeadCreate,
    LeadResponse,
    LeadUpdate,
    PaginatedLeadsResponse,
)
from app.services.excel_export_service import export_leads_to_excel
from app.services.lead_service import (
    audit_and_reclassify_leads,
    export_leads_to_csv,
    fetch_lead_by_id,
    fetch_leads,
    process_lead,
    update_lead_record,
)

router = APIRouter(prefix="/api/leads", tags=["Leads"])


@router.post(
    "",
    response_model=LeadResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_lead(
    lead_data: LeadCreate,
    db: Session = Depends(get_db),
):
    try:
        lead, created = process_lead(db, lead_data)
        db.commit()
        db.refresh(lead)
        return lead

    except ValueError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc

    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to save lead.",
        ) from exc


@router.get(
    "",
    response_model=PaginatedLeadsResponse,
)
def get_leads_endpoint(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    search: str | None = None,
    status: str | None = None,
    country: str | None = None,
    university: str | None = None,
    profession: str | None = None,
    job_id: int | None = None,
    db: Session = Depends(get_db),
):
    """Retrieve paginated leads with full filtering and search."""
    items, total, total_pages = fetch_leads(
        db=db,
        page=page,
        page_size=page_size,
        search=search,
        status=status,
        country=country,
        university=university,
        profession=profession,
        job_id=job_id,
    )
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
        "items": items,
    }


@router.post("/audit")
def audit_leads_endpoint(
    db: Session = Depends(get_db),
):
    """Audit all stored leads against enhanced name cleaning and generic email rules.

    Safely reclassifies suspicious records without deleting historical data.
    """
    return audit_and_reclassify_leads(db)


@router.get("/export")
def export_leads_csv_endpoint(
    status: str | None = "qualified",
    job_id: int | None = None,
    db: Session = Depends(get_db),
):
    """Download qualified leads formatted as a downloadable CSV."""
    csv_data = export_leads_to_csv(db=db, status=status, job_id=job_id)
    filename = f"sitech_leads_{status or 'all'}.csv"
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/export-xlsx")
def export_leads_xlsx_endpoint(
    status: str | None = "qualified",
    job_id: int | None = None,
    db: Session = Depends(get_db),
):
    """Download qualified leads formatted as a native Microsoft Excel (.xlsx) spreadsheet."""
    excel_data = export_leads_to_excel(db=db, status=status, job_id=job_id)
    filename = f"sitech_leads_{status or 'all'}.xlsx"
    return Response(
        content=excel_data,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get(
    "/{lead_id}",
    response_model=LeadResponse,
)
def get_lead_by_id_endpoint(
    lead_id: int,
    db: Session = Depends(get_db),
):
    """Retrieve full details of a single lead."""
    lead = fetch_lead_by_id(db, lead_id)
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lead not found.",
        )
    return lead


@router.patch(
    "/{lead_id}",
    response_model=LeadResponse,
)
def update_lead_endpoint(
    lead_id: int,
    update_data: LeadUpdate,
    db: Session = Depends(get_db),
):
    """Update lead information or qualification status."""
    try:
        updated = update_lead_record(db, lead_id, update_data)
        if not updated:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Lead not found.",
            )
        db.commit()
        db.refresh(updated)
        return updated
    except ValueError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error while updating lead.",
        ) from exc
