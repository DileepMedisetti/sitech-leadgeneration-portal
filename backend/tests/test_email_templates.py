import io
import uuid
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.db.database import SessionLocal
from app.main import app
from app.models.email_template import EmailTemplate
from app.services.cloudinary_storage_service import cloudinary_storage_service
from app.services.email_template_service import email_template_service


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def db():
    session = SessionLocal()
    yield session
    session.close()


def test_list_email_templates_auto_seeds_starters(client):
    """Calling GET /api/templates should auto-seed default starter templates if empty and return items."""
    resp = client.get("/api/templates?page=1&page_size=20")
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data
    assert "total" in data
    assert "categories" in data
    assert data["total"] >= 4
    assert len(data["items"]) >= 4

    names = [item["name"] for item in data["items"]]
    assert any("Academic Research Collaboration" in n for n in names)
    assert any("Symposium" in n or "Keynote" in n for n in names)


def test_filter_templates_by_category_and_search(client):
    """Filtering by category and search keyword should narrow results correctly."""
    # List all first
    resp_all = client.get("/api/templates?page_size=50")
    assert resp_all.status_code == 200
    all_data = resp_all.json()

    # Search for "Academic"
    resp_search = client.get("/api/templates?search=Academic")
    assert resp_search.status_code == 200
    search_data = resp_search.json()
    assert search_data["total"] > 0
    for item in search_data["items"]:
        text = f"{item['name']} {item.get('description', '')} {item['category']}".lower()
        assert "academic" in text

    # Filter by specific category
    first_cat = all_data["categories"][0]
    resp_cat = client.get(f"/api/templates?category={first_cat}")
    assert resp_cat.status_code == 200
    cat_data = resp_cat.json()
    assert cat_data["total"] > 0
    for item in cat_data["items"]:
        assert item["category"].lower() == first_cat.lower()


def test_get_template_by_id_and_raw_html(client):
    """GET /api/templates/{id} and /api/templates/{id}/raw should return correct data."""
    list_resp = client.get("/api/templates?page_size=1")
    template_id = list_resp.json()["items"][0]["id"]

    # Metadata
    get_resp = client.get(f"/api/templates/{template_id}")
    assert get_resp.status_code == 200
    data = get_resp.json()
    assert data["id"] == template_id
    assert "html_content" in data
    assert len(data["html_content"]) > 10

    # Raw HTML endpoint
    raw_resp = client.get(f"/api/templates/{template_id}/raw")
    assert raw_resp.status_code == 200
    assert "text/html" in raw_resp.headers["content-type"]
    assert "<" in raw_resp.text and ">" in raw_resp.text


def test_create_template_json(client, db: Session):
    """POST /api/templates creates a new custom email template."""
    uid = uuid.uuid4().hex[:6]
    name = f"Custom Test Template {uid}"
    html = f"<html><body><h1>Hello World {uid}</h1><p>Content</p></body></html>"

    payload = {
        "name": name,
        "description": "A test custom template",
        "category": "Promotional",
        "html_content": html,
        "subject_hint": "Exclusive Offer Inside",
    }
    resp = client.post("/api/templates", json=payload)
    assert resp.status_code == 201
    created = resp.json()
    assert created["name"] == name
    assert created["category"] == "Promotional"
    assert created["html_content"] == html
    assert created["id"] > 0

    # Clean up
    client.delete(f"/api/templates/{created['id']}")


def test_import_template_file_upload(client):
    """POST /api/templates/import imports an HTML file upload successfully."""
    uid = uuid.uuid4().hex[:6]
    filename = f"newsletter_{uid}.html"
    content = f"""<!DOCTYPE html>
<html>
<head><title>Test Newsletter {uid}</title></head>
<body>
  <h2>Welcome to our Newsletter</h2>
  <p>Here is great news for {{name}}.</p>
</body>
</html>"""
    file_bytes = content.encode("utf-8")

    response = client.post(
        "/api/templates/import",
        data={
            "name": f"Imported Newsletter {uid}",
            "category": "Newsletter",
            "description": "Imported via test upload",
            "subject_hint": "Monthly News Digest",
        },
        files={
            "file": (filename, io.BytesIO(file_bytes), "text/html"),
        },
    )
    assert response.status_code == 201
    imported = response.json()
    assert imported["name"] == f"Imported Newsletter {uid}"
    assert imported["category"] == "Newsletter"
    assert imported["original_filename"] == filename
    assert "Welcome to our Newsletter" in imported["html_content"]

    # Verify template exists in listing
    search_resp = client.get(f"/api/templates?search={uid}")
    assert search_resp.status_code == 200
    assert search_resp.json()["total"] >= 1

    # Clean up
    client.delete(f"/api/templates/{imported['id']}")


def test_import_template_validation_errors(client):
    """Import rejects non-HTML files, empty files, or invalid content."""
    # 1. Invalid file extension (.pdf or .txt)
    txt_resp = client.post(
        "/api/templates/import",
        data={"name": "Invalid File"},
        files={"file": ("document.txt", io.BytesIO(b"Hello world"), "text/plain")},
    )
    assert txt_resp.status_code == 422
    assert "Only .html or .htm" in txt_resp.json()["detail"]

    # 2. Empty file
    empty_resp = client.post(
        "/api/templates/import",
        data={"name": "Empty File"},
        files={"file": ("empty.html", io.BytesIO(b""), "text/html")},
    )
    assert empty_resp.status_code == 422
    assert "empty" in empty_resp.json()["detail"].lower()

    # 3. Non-HTML content
    no_html_resp = client.post(
        "/api/templates/import",
        data={"name": "Plain Text Masquerading as HTML"},
        files={"file": ("test.html", io.BytesIO(b"just some plain text without any html tags"), "text/html")},
    )
    assert no_html_resp.status_code == 422
    assert "valid HTML markup" in no_html_resp.json()["detail"]


def test_update_and_delete_template(client):
    """PATCH and DELETE operations work correctly on email templates."""
    # Create template
    uid = uuid.uuid4().hex[:6]
    create_resp = client.post(
        "/api/templates",
        json={
            "name": f"To Update {uid}",
            "category": "General",
            "html_content": "<p>Initial</p>",
        },
    )
    assert create_resp.status_code == 201
    t_id = create_resp.json()["id"]

    # Update template
    patch_resp = client.patch(
        f"/api/templates/{t_id}",
        json={
            "name": f"Updated Name {uid}",
            "category": "Follow-up",
            "html_content": "<p>Updated content</p>",
        },
    )
    assert patch_resp.status_code == 200
    updated = patch_resp.json()
    assert updated["name"] == f"Updated Name {uid}"
    assert updated["category"] == "Follow-up"
    assert updated["html_content"] == "<p>Updated content</p>"

    # Delete template
    del_resp = client.delete(f"/api/templates/{t_id}")
    assert del_resp.status_code == 204

    # Verify 404 on subsequent get
    get_after = client.get(f"/api/templates/{t_id}")
    assert get_after.status_code == 404
