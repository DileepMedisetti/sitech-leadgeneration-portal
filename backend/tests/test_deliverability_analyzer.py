import pytest
from app.services.deliverability.analyzer_service import analyze_email_content
from app.services.deliverability.rules_config import RULE_CONFIG


def test_clean_compliant_email_passes_with_low_risk():
    subject = "Invitation to Collaborate on Academic Research"
    preview_text = "Reviewing the 2026 faculty development initiatives."
    from_name = "Dr. Jane Smith"
    from_email = "jane.smith@sitechseries.org"
    reply_to = "jane.smith@sitechseries.org"
    html_content = """
    <html>
      <body>
        <p>Dear {{name}},</p>
        <p>I hope this email finds you well. We are coordinating research partnerships across computer science departments.</p>
        <p>Please review our proposal at <a href="https://sitechseries.org/proposal">our proposal portal</a>.</p>
        <p><img src="https://sitechseries.org/logo.png" alt="Sitech Series Logo" /></p>
        <hr />
        <p>Sitech Research Institute, 100 Innovation Way, Suite 400, Cambridge, MA 02142</p>
        <p><a href="https://sitechseries.org/unsubscribe?id=123">Unsubscribe from future announcements</a></p>
      </body>
    </html>
    """
    plain_text = (
        "Dear {{name}},\n\n"
        "We are coordinating research partnerships across computer science departments.\n\n"
        "Sitech Research Institute, 100 Innovation Way, Suite 400, Cambridge, MA 02142\n"
        "Unsubscribe: https://sitechseries.org/unsubscribe?id=123"
    )

    risk_score, risk_level, findings, category_scores, has_blockers = analyze_email_content(
        subject=subject,
        preview_text=preview_text,
        from_name=from_name,
        from_email=from_email,
        reply_to=reply_to,
        html_content=html_content,
        plain_text=plain_text,
        unsubscribe_url="https://sitechseries.org/unsubscribe?id=123",
    )

    failed_findings = [f for f in findings if f.status == "failed"]
    assert not has_blockers
    assert risk_level in {"low", "medium"}
    assert all(f.severity != "blocker" for f in failed_findings)


def test_malicious_script_triggers_blocker_and_critical_risk():
    subject = "URGENT NOTICE: YOUR ACCOUNT IS RESTRICTED!!!"
    from_name = "Account Admin"
    from_email = "admin@gmail.com"  # free mailbox
    reply_to = "attacker@otherdomain.com"  # alignment mismatch
    html_content = """
    <html>
      <body>
        <script>alert('pwned');</script>
        <p>ACT NOW! 100% free guaranteed wire transfer payout!</p>
        <a href="http://192.168.1.100/login">Click here to verify</a>
        <a href="http://evil-phish.com">Visit harvard.edu</a>
      </body>
    </html>
    """

    risk_score, risk_level, findings, category_scores, has_blockers = analyze_email_content(
        subject=subject,
        preview_text=None,
        from_name=from_name,
        from_email=from_email,
        reply_to=reply_to,
        html_content=html_content,
        plain_text=None,
    )

    assert has_blockers is True
    assert risk_level == "critical"
    failed_codes = {f.rule_code for f in findings if f.status == "failed"}
    assert "HTML_SCRIPT_OR_IFRAME" in failed_codes
    assert "SUBJ_ALL_CAPS" in failed_codes or "SUBJ_EXCESSIVE_PUNCTUATION" in failed_codes
    assert "AUTH_FREE_MAILBOX_SENDER" in failed_codes
    assert "AUTH_DOMAIN_ALIGNMENT_MISMATCH" in failed_codes
    assert "COMPL_MISSING_UNSUBSCRIBE" in failed_codes
    assert "HTML_MISSING_PLAIN_TEXT" in failed_codes
    assert "HTML_RAW_IP_LINK" in failed_codes
    assert "HTML_LINK_DESTINATION_MISMATCH" in failed_codes


def test_token_malformed_and_unsupported_detection():
    subject = "Hello {name}, your {{unsupported_xyz_token}} is ready"
    html_content = """
    <div>
      <p>Dear {{first_name,</p>
      <p>Contact list: {{university}}</p>
      <p>Unsubscribe: <a href="{{unsubscribe_url}}">Unsubscribe</a></p>
      <p>123 Research Way, Suite 10, Boston, MA</p>
    </div>
    """
    plain_text = "Dear {{first_name, unsubscribe: {{unsubscribe_url}}"

    risk_score, risk_level, findings, category_scores, has_blockers = analyze_email_content(
        subject=subject,
        preview_text=None,
        from_name="Test",
        from_email="test@sitechseries.org",
        reply_to="test@sitechseries.org",
        html_content=html_content,
        plain_text=plain_text,
    )

    failed_codes = {f.rule_code for f in findings if f.status == "failed"}
    assert "TOKEN_MALFORMED_SYNTAX" in failed_codes
    assert "TOKEN_UNSUPPORTED_VARIABLE" in failed_codes
