from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class EmailTemplateBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = Field(default=None)
    category: str = Field(default="General", max_length=100)
    html_content: str = Field(..., min_length=1)
    subject_hint: str | None = Field(default=None, max_length=255)


class EmailTemplateCreate(EmailTemplateBase):
    original_filename: str | None = None
    mime_type: str = "text/html"
    file_size: int | None = None
    is_system_template: bool = False


class EmailTemplateUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    category: str | None = Field(default=None, max_length=100)
    html_content: str | None = Field(default=None, min_length=1)
    subject_hint: str | None = Field(default=None, max_length=255)
    is_active: bool | None = None


class EmailTemplateResponse(EmailTemplateBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    original_filename: str | None = None
    mime_type: str = "text/html"
    file_size: int | None = None
    storage_provider: str = "cloudinary"
    cloudinary_public_id: str | None = None
    cloudinary_url: str | None = None
    thumbnail_url: str | None = None
    is_active: bool = True
    is_system_template: bool = False
    created_at: datetime
    updated_at: datetime


class PaginatedEmailTemplatesResponse(BaseModel):
    items: list[EmailTemplateResponse]
    total: int
    page: int
    page_size: int
    total_pages: int
    categories: list[str]
