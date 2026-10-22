from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.schemas.audience import (
    AddContactsToListRequest,
    ContactFiltersResponse,
    ContactListCreate,
    ContactListCreateResponse,
    ContactListResponse,
    ContactListUpdate,
    MembershipBatchSummary,
    PaginatedContactListsResponse,
    PaginatedContactsResponse,
    PaginatedListMembersResponse,
    RemoveContactsFromListRequest,
    RemoveContactsResponse,
)
from app.services.audience_service import (
    add_leads_to_list,
    create_new_list,
    fetch_contact_filters,
    fetch_contacts,
    fetch_list_by_id,
    fetch_list_members,
    fetch_lists,
    remove_leads_from_list,
    remove_list,
    update_existing_list,
)

router = APIRouter(prefix="/api/audience", tags=["Audience"])


# ==============================================================================
# Contacts Endpoints
# ==============================================================================


@router.get(
    "/contacts",
    response_model=PaginatedContactsResponse,
)
def get_contacts_endpoint(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    search: str | None = None,
    country: str | None = None,
    university: str | None = None,
    department: str | None = None,
    profession: str | None = None,
    job_id: int | None = None,
    sort_by: str = Query(default="created_at"),
    sort_order: str = Query(default="desc", pattern="^(asc|desc)$"),
    db: Session = Depends(get_db),
):
    """Retrieve paginated eligible contacts with database-level searching, filtering and sorting."""
    page = page if isinstance(page, int) else 1
    page_size = page_size if isinstance(page_size, int) else 20
    sort_by = sort_by if isinstance(sort_by, str) else "created_at"
    sort_order = sort_order if isinstance(sort_order, str) else "desc"

    allowed_sort_fields = {
        "created_at",
        "name",
        "email",
        "university",
        "country",
        "profession",
        "confidence_score",
    }
    if sort_by not in allowed_sort_fields:
        sort_by = "created_at"

    items, total, total_pages = fetch_contacts(
        db=db,
        page=page,
        page_size=page_size,
        search=search,
        country=country,
        university=university,
        department=department,
        profession=profession,
        job_id=job_id,
        sort_by=sort_by,
        sort_order=sort_order,
    )

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
        "items": items,
    }


@router.get(
    "/contacts/filters",
    response_model=ContactFiltersResponse,
)
def get_contact_filters_endpoint(
    db: Session = Depends(get_db),
):
    """Retrieve available filter options derived dynamically from eligible contacts."""
    return fetch_contact_filters(db)


# ==============================================================================
# Lists Endpoints
# ==============================================================================


@router.get(
    "/lists",
    response_model=PaginatedContactListsResponse,
)
def get_lists_endpoint(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    search: str | None = None,
    filter: str | None = Query(default=None, pattern="^(all|with_contacts|empty)$"),
    updated_within: str | None = Query(default=None, pattern="^(any|7_days|30_days)$"),
    sort_by: str = Query(default="updated_at"),
    sort_order: str = Query(default="desc", pattern="^(asc|desc)$"),
    db: Session = Depends(get_db),
):
    """Retrieve saved contact lists with accurate contact counts and filter criteria."""
    page = page if isinstance(page, int) else 1
    page_size = page_size if isinstance(page_size, int) else 20
    sort_by = sort_by if isinstance(sort_by, str) else "updated_at"
    sort_order = sort_order if isinstance(sort_order, str) else "desc"
    filter_val = filter if isinstance(filter, str) else None
    updated_within_val = updated_within if isinstance(updated_within, str) else None

    allowed_sort_fields = {"updated_at", "created_at", "name", "contact_count"}
    if sort_by not in allowed_sort_fields:
        sort_by = "updated_at"

    items, total, total_pages = fetch_lists(
        db=db,
        page=page,
        page_size=page_size,
        search=search,
        filter_type=filter_val,
        updated_within=updated_within_val,
        sort_by=sort_by,
        sort_order=sort_order,
    )

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
        "items": items,
    }


@router.post(
    "/lists",
    response_model=ContactListCreateResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_list_endpoint(
    payload: ContactListCreate,
    db: Session = Depends(get_db),
):
    """Create a new contact list, optionally enrolling initial contacts atomically."""
    try:
        contact_list, membership_summary = create_new_list(db, payload)
        db.commit()
        return {
            **contact_list,
            "membership_summary": membership_summary,
        }
    except ValueError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A contact list with this name already exists.",
        ) from exc
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error while creating contact list.",
        ) from exc


@router.get(
    "/lists/{list_id}",
    response_model=ContactListResponse,
)
def get_list_by_id_endpoint(
    list_id: int,
    db: Session = Depends(get_db),
):
    """Retrieve single contact list details with accurate contact count."""
    contact_list = fetch_list_by_id(db, list_id)
    if not contact_list:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Contact list with ID {list_id} was not found.",
        )
    return contact_list


@router.patch(
    "/lists/{list_id}",
    response_model=ContactListResponse,
)
def update_list_endpoint(
    list_id: int,
    payload: ContactListUpdate,
    db: Session = Depends(get_db),
):
    """Update contact list metadata (name, description)."""
    try:
        updated = update_existing_list(db, list_id, payload)
        if not updated:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Contact list with ID {list_id} was not found.",
            )
        db.commit()
        return updated
    except ValueError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Another contact list with this name already exists.",
        ) from exc
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error while updating contact list.",
        ) from exc


@router.delete(
    "/lists/{list_id}",
    status_code=status.HTTP_200_OK,
)
def delete_list_endpoint(
    list_id: int,
    db: Session = Depends(get_db),
):
    """Delete a contact list and its memberships without deleting source leads."""
    try:
        deleted = remove_list(db, list_id)
        if not deleted:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Contact list with ID {list_id} was not found.",
            )
        db.commit()
        return {
            "status": "success",
            "message": f"Contact list {list_id} has been deleted successfully.",
        }
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error while deleting contact list.",
        ) from exc


@router.get(
    "/lists/{list_id}/contacts",
    response_model=PaginatedListMembersResponse,
)
def get_list_contacts_endpoint(
    list_id: int,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    search: str | None = None,
    sort_by: str = Query(default="added_at"),
    sort_order: str = Query(default="desc", pattern="^(asc|desc)$"),
    db: Session = Depends(get_db),
):
    """Retrieve members enrolled in a specific contact list."""
    page = page if isinstance(page, int) else 1
    page_size = page_size if isinstance(page_size, int) else 20
    sort_by = sort_by if isinstance(sort_by, str) else "added_at"
    sort_order = sort_order if isinstance(sort_order, str) else "desc"

    allowed_sort_fields = {"added_at", "name", "email"}
    if sort_by not in allowed_sort_fields:
        sort_by = "added_at"

    result = fetch_list_members(
        db=db,
        list_id=list_id,
        page=page,
        page_size=page_size,
        search=search,
        sort_by=sort_by,
        sort_order=sort_order,
    )
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Contact list with ID {list_id} was not found.",
        )

    contact_list, items, total, total_pages = result
    return {
        "list_id": contact_list.id,
        "list_name": contact_list.name,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
        "items": items,
    }


@router.post(
    "/lists/{list_id}/contacts",
    response_model=MembershipBatchSummary,
    status_code=status.HTTP_200_OK,
)
def add_contacts_to_list_endpoint(
    list_id: int,
    payload: AddContactsToListRequest,
    db: Session = Depends(get_db),
):
    """Add selected leads to a contact list with duplicate email prevention and eligibility checks."""
    try:
        summary = add_leads_to_list(
            db=db,
            list_id=list_id,
            lead_ids=payload.lead_ids,
        )
        db.commit()
        return summary
    except ValueError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND if "does not exist" in str(exc) else status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A membership conflict occurred (duplicate email or lead).",
        ) from exc
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error while adding contacts to list.",
        ) from exc


@router.delete(
    "/lists/{list_id}/contacts",
    response_model=RemoveContactsResponse,
    status_code=status.HTTP_200_OK,
)
def remove_contacts_from_list_endpoint(
    list_id: int,
    payload: RemoveContactsFromListRequest | None = None,
    lead_ids: list[int] | None = Query(default=None),
    db: Session = Depends(get_db),
):
    """Remove memberships for specified leads from a contact list without deleting source leads."""
    target_ids = []
    if payload and payload.lead_ids:
        target_ids.extend(payload.lead_ids)
    if lead_ids:
        target_ids.extend(lead_ids)
    target_ids = list(dict.fromkeys(target_ids))
    if not target_ids:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="At least one lead ID must be provided to remove.",
        )

    try:
        removed_ids = remove_leads_from_list(
            db=db,
            list_id=list_id,
            lead_ids=target_ids,
        )
        db.commit()
        return {
            "removed": len(removed_ids),
            "removed_lead_ids": removed_ids,
        }
    except ValueError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error while removing contacts from list.",
        ) from exc
