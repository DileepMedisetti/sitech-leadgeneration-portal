import os
from app.services.email_delivery_service import EmailDeliveryService


def test_otp_email_template_has_six_boxes():
    """Validates that build_otp_email_markup generates exactly 6 individual table-based digit boxes."""
    service = EmailDeliveryService()
    test_otp = "482619"
    html_body, plain_body = service.build_otp_email_markup(test_otp)

    # 1. Mandatory heading and copy
    assert "Verify your email address" in html_body
    assert "Use the verification code below to securely sign in to your Sitech Series workspace." in html_body

    # 2. Branded header
    assert "LEAD INTELLIGENCE PORTAL" in html_body
    assert "cid:sitech_logo" in html_body
    assert "#101A33" in html_body  # Deep navy brand color
    assert "#25C7F7" in html_body  # Bright cyan accent

    # 3. 6 individual digit boxes in HTML
    for digit in ["4", "8", "2", "6", "1", "9"]:
        assert f">{digit}</td>" in html_body

    # Count digit box cells (must have at least 6 cells with font-size: 26px and #101A33)
    assert html_body.count("border: 1.5px solid #3563F5") == 6
    assert html_body.count("background-color: #F3F6FC") >= 6

    # 4. Expiration and security notice
    assert "Your verification code expires in 10 minutes" in html_body
    assert "Never share your verification code with anyone" in html_body

    # 5. Professional footer
    assert "Sitech Series" in html_body
    assert "Secure access to your workspace" in html_body

    # 6. Plain-text version format
    assert "[ 4 ]  [ 8 ]  [ 2 ]  [ 6 ]  [ 1 ]  [ 9 ]" in plain_body
    assert "Verification code: 482619" in plain_body
    assert "expires in 10 minutes" in plain_body


def test_smtp_connection_verification():
    """Tests the live SMTP connection and authentication handshake without dispatching real emails."""
    service = EmailDeliveryService()
    if service.smtp_host:
        ok, msg = service.verify_smtp_connection()
        assert ok is True, f"SMTP handshake failed: {msg}"
        assert "verified successfully" in msg.lower()


def test_synthetic_domain_safeguard():
    """Ensures test domains like @example.com are never dispatched externally during test runs."""
    service = EmailDeliveryService()
    ok, msg = service.send_otp_email("qa_tester@example.com", "999888")
    assert ok is True
    assert "Test Safe Mode" in msg
