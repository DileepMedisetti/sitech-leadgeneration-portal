import logging
from typing import Optional
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Response, UploadFile, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.schemas.email_template import (
    EmailTemplateCreate,
    EmailTemplateUpdate,
    EmailTemplateResponse,
    PaginatedEmailTemplatesResponse,
)
from app.services.email_template_service import email_template_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/templates", tags=["Email Templates"])


@router.get("", response_model=PaginatedEmailTemplatesResponse)
def list_email_templates(
    search: Optional[str] = Query(default=None, description="Search query across name, description, category"),
    category: Optional[str] = Query(default=None, description="Filter by category"),
    sort_by: str = Query(default="created_at", description="Field to sort by: created_at, name, category"),
    sort_order: str = Query(default="desc", description="Sort direction: asc or desc"),
    page: int = Query(default=1, ge=1, description="Page number"),
    page_size: int = Query(default=12, ge=1, le=100, description="Items per page"),
    db: Session = Depends(get_db),
):
    """
    List email templates with optional search, category filter, sorting, and pagination.
    Automatically seeds starter templates if none exist.
    """
    # Ensure starter templates are present
    try:
        email_template_service.seed_default_templates(db)
    except Exception as e:
        logger.warning(f"Could not seed starter templates: {e}")

    return email_template_service.list_templates(
        db=db,
        search=search,
        category=category,
        sort_by=sort_by,
        sort_order=sort_order,
        page=page,
        page_size=page_size,
    )


@router.get("/{template_id}", response_model=EmailTemplateResponse)
def get_email_template(template_id: int, db: Session = Depends(get_db)):
    """
    Get a single template by ID.
    """
    template = email_template_service.get_template_by_id(db, template_id)
    if not template or not template.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Template with id {template_id} not found",
        )
    return EmailTemplateResponse.model_validate(template)


@router.get("/{template_id}/raw")
def get_email_template_raw_html(template_id: int, db: Session = Depends(get_db)):
    """
    Returns the raw HTML content of a template, suitable for sandboxed iframe rendering.
    """
    template = email_template_service.get_template_by_id(db, template_id)
    if not template or not template.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Template with id {template_id} not found",
        )
    return Response(content=template.html_content, media_type="text/html; charset=utf-8")


@router.post("", response_model=EmailTemplateResponse, status_code=status.HTTP_201_CREATED)
def create_email_template(
    template_in: EmailTemplateCreate,
    db: Session = Depends(get_db),
):
    """
    Create a new email template from JSON payload.
    """
    try:
        created = email_template_service.create_template(db, template_in, upload_to_cloudinary=True)
        return EmailTemplateResponse.model_validate(created)
    except Exception as e:
        logger.error(f"Failed to create template: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create template: {str(e)}",
        )


@router.post("/import", response_model=EmailTemplateResponse, status_code=status.HTTP_201_CREATED)
async def import_email_template_file(
    file: UploadFile = File(..., description="HTML or HTM file to import"),
    name: str = Form(..., description="Template display name"),
    category: str = Form("General", description="Template category"),
    description: Optional[str] = Form(None, description="Optional description"),
    subject_hint: Optional[str] = Form(None, description="Optional default subject line"),
    db: Session = Depends(get_db),
):
    """
    Import an HTML template file (.html, .htm) with validation and Cloudinary storage.
    """
    filename = file.filename or "template.html"
    try:
        content_bytes = await file.read()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to read uploaded file: {str(e)}",
        )

    # Validate file
    try:
        email_template_service.validate_html_file(content_bytes, filename)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e),
        )

    html_str = content_bytes.decode("utf-8", errors="replace")

    template_in = EmailTemplateCreate(
        name=name.strip() if name else filename.rsplit(".", 1)[0],
        category=category.strip() if category else "General",
        description=description.strip() if description else None,
        subject_hint=subject_hint.strip() if subject_hint else None,
        html_content=html_str,
        original_filename=filename,
        mime_type=file.content_type or "text/html",
        file_size=len(content_bytes),
        is_system_template=False,
    )

    try:
        created = email_template_service.create_template(db, template_in, upload_to_cloudinary=True)
        return EmailTemplateResponse.model_validate(created)
    except Exception as e:
        logger.error(f"Failed to import template: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to import template: {str(e)}",
        )


@router.patch("/{template_id}", response_model=EmailTemplateResponse)
def update_email_template(
    template_id: int,
    template_in: EmailTemplateUpdate,
    db: Session = Depends(get_db),
):
    """
    Update an existing template's metadata or HTML content.
    """
    updated = email_template_service.update_template(db, template_id, template_in)
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Template with id {template_id} not found",
        )
    return EmailTemplateResponse.model_validate(updated)


@router.delete("/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_email_template(template_id: int, db: Session = Depends(get_db)):
    """
    Delete a template and its associated Cloudinary asset.
    """
    success = email_template_service.delete_template(db, template_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Template with id {template_id} not found",
        )
    return Response(status_code=status.HTTP_204_NO_CONTENT)
