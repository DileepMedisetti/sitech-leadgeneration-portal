from datetime import datetime
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class ContactResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: EmailStr | None = None
    phone_number: str | None = None
    profession: str | None = None
    department: str | None = None
    research_specialization: str | None = None
    university: str | None = None
    country: str | None = None
    website: str | None = None
    linkedin_url: str | None = None
    source_url: str | None = None
    qualification_status: str = "qualified"
    confidence_score: float | None = None
    created_at: datetime
    updated_at: datetime


class PaginatedContactsResponse(BaseModel):
    total: int
    page: int
    page_size: int
    total_pages: int
    items: list[ContactResponse]


class ContactFiltersResponse(BaseModel):
    countries: list[str]
    universities: list[str]
    departments: list[str]
    professions: list[str]


class MembershipBatchSummary(BaseModel):
    requested: int
    added: int
    skipped_duplicates: int
    rejected_invalid: int
    added_lead_ids: list[int] = []
    skipped_lead_ids: list[int] = []
    invalid_lead_ids: list[int] = []


class CustomContactCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    email: EmailStr
    profession: str | None = None
    university: str | None = None
    country: str | None = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Contact name cannot be empty.")
        return value

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        return value.strip().lower()


class ContactListCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str | None = None
    list_type: str = "custom"
    lead_ids: list[int] = []
    contacts: list[CustomContactCreate] = []

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("List name cannot be empty.")
        return value



class ContactListUpdate(BaseModel):
    name: str | None = None
    description: str | None = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        if not value:
            raise ValueError("List name cannot be empty.")
        return value


class ContactListResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str | None = None
    list_type: str = "custom"
    contact_count: int = 0
    created_at: datetime
    updated_at: datetime


class ContactListCreateResponse(ContactListResponse):
    membership_summary: MembershipBatchSummary | None = None


class PaginatedContactListsResponse(BaseModel):
    total: int
    page: int
    page_size: int
    total_pages: int
    items: list[ContactListResponse]


class AddContactsToListRequest(BaseModel):
    lead_ids: list[int] = Field(min_length=1)


class RemoveContactsFromListRequest(BaseModel):
    lead_ids: list[int] = Field(min_length=1)


class RemoveContactsResponse(BaseModel):
    removed: int
    removed_lead_ids: list[int]


class ListMemberContactResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int  # Lead ID
    lead_id: int
    membership_id: int
    name: str
    email: EmailStr | None = None
    phone_number: str | None = None
    profession: str | None = None
    department: str | None = None
    research_specialization: str | None = None
    university: str | None = None
    country: str | None = None
    website: str | None = None
    linkedin_url: str | None = None
    source_url: str | None = None
    qualification_status: str = "qualified"
    confidence_score: float | None = None
    added_at: datetime


class PaginatedListMembersResponse(BaseModel):
    list_id: int
    list_name: str
    total: int
    page: int
    page_size: int
    total_pages: int
    items: list[ListMemberContactResponse]
