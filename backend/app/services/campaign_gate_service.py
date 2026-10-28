from datetime import datetime, timezone
import logging
import re
from typing import Any
import urllib.parse
from bs4 import BeautifulSoup
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.campaign import Campaign, CampaignAudienceList, CampaignContent, CampaignRecipientSnapshot
from app.models.email_account import EmailAccount
from app.models.lead import Lead
from app.repositories.campaign_repository import (
    get_campaign_by_id,
    get_latest_campaign_content,
    snapshot_campaign_recipients,
)
from app.schemas.campaign import (
    CampaignConfirmSendRequest,
    CampaignPreflightResponse,
    CampaignScheduleRequest,
    PreflightCheckItem,
)
from app.services.audience_service import is_lead_eligible_contact
from app.services.deliverability.analyzer_service import get_latest_campaign_report
from app.services.email_delivery_service import EmailDeliveryService
from app.services.ml.inference_service import predict_campaign_placement
from app.services.placement.placement_service import get_latest_placement_test

logger = logging.getLogger(__name__)


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def evaluate_campaign_preflight(
    db: Session,
    campaign_id: int,
) -> CampaignPreflightResponse:
    """Evaluates all pre-launch readiness checks across 10 categories,
    identifying blocking issues, advisories, and actionable recommendations.
    """
    campaign = get_campaign_by_id(db, campaign_id)
    if not campaign:
        raise ValueError(f"Campaign {campaign_id} not found.")

    content = get_latest_campaign_content(db, campaign_id)
    report = get_latest_campaign_report(db, campaign_id)
    placement = get_latest_placement_test(db, campaign_id)
    prediction = predict_campaign_placement(db, campaign_id) if content else None

    checks: list[PreflightCheckItem] = []
    blockers: list[str] = []
    warnings: list[str] = []

    # --------------------------------------------------------------------------
    # 1. Campaign Details
    # --------------------------------------------------------------------------
    if not campaign.name or len(campaign.name.strip()) < 2:
        blockers.append("Campaign name is required.")
        checks.append(
            PreflightCheckItem(
                id="check_campaign_details_name",
                category="campaign_details",
                label="Campaign Name & Metadata",
                status="blocked",
                detail="Campaign name is missing or too short.",
                why_it_matters="Identifies the campaign for tracking, analytics, and audit logging.",
                recommendation="Provide a clear, descriptive campaign title in Campaign Details.",
                related_step=1,
                action_label="Edit Details",
            )
        )
    else:
        checks.append(
            PreflightCheckItem(
                id="check_campaign_details_name",
                category="campaign_details",
                label="Campaign Name & Metadata",
                status="passed",
                detail=f"Campaign name: '{campaign.name}'",
                why_it_matters="Identifies the campaign for tracking, analytics, and audit logging.",
                recommendation="No action needed.",
                related_step=1,
                action_label="Edit Details",
            )
        )

    # Sender account selection
    if campaign.email_account_id is None:
        checks.append(
            PreflightCheckItem(
                id="check_campaign_sender_account",
                category="campaign_details",
                label="Sender Account Association",
                status="warning",
                detail="No dedicated email account selected; falling back to sender details.",
                why_it_matters="Associating an Email Account guarantees authenticated SMTP routing.",
                recommendation="Select an active verified Email Account from the sender dropdown.",
                related_step=1,
                action_label="Review Sender",
            )
        )
    else:
        checks.append(
            PreflightCheckItem(
                id="check_campaign_sender_account",
                category="campaign_details",
                label="Sender Account Association",
                status="passed",
                detail=f"Configured with verified Email Account #{campaign.email_account_id}.",
                why_it_matters="Associating an Email Account guarantees authenticated SMTP routing.",
                recommendation="No action needed.",
                related_step=1,
                action_label="Review Sender",
            )
        )

    # --------------------------------------------------------------------------
    # 2. Sender Identity
    # --------------------------------------------------------------------------
    if not content:
        blockers.append("No email content has been created for this campaign.")
        checks.append(
            PreflightCheckItem(
                id="check_sender_identity",
                category="sender_identity",
                label="Sender Identity & Provider Readiness",
                status="blocked",
                detail="Missing sender identity details.",
                why_it_matters="Receiving mail servers reject unauthenticated sender identities.",
                recommendation="Configure sender name and email address in Campaign Details.",
                related_step=1,
                action_label="Review Sender",
            )
        )
    else:
        clean_from = content.from_email.strip().lower()
        if not clean_from:
            blockers.append("Sender from_email address is required.")
            checks.append(
                PreflightCheckItem(
                    id="check_sender_identity",
                    category="sender_identity",
                    label="Sender Identity & Provider Readiness",
                    status="blocked",
                    detail="Sender from_email address is empty.",
                    why_it_matters="A valid from_email is mandatory to originate SMTP dispatch.",
                    recommendation="Enter a valid organizational sender email.",
                    related_step=1,
                    action_label="Review Sender",
                )
            )
        else:
            from app.services.sender_eligibility_service import validate_sender_eligibility
            is_sender_ok, sender_msg = validate_sender_eligibility(db, clean_from)
            if not is_sender_ok:
                blockers.append(sender_msg)
                checks.append(
                    PreflightCheckItem(
                        id="check_sender_identity",
                        category="sender_identity",
                        label="Sender Identity & Provider Readiness",
                        status="blocked",
                        detail=sender_msg,
                        why_it_matters="Only verified active email accounts are permitted to dispatch.",
                        recommendation="Verify your email account in Email Accounts settings.",
                        related_step=1,
                        action_label="Review Sender",
                    )
                )
            else:
                checks.append(
                    PreflightCheckItem(
                        id="check_sender_identity",
                        category="sender_identity",
                        label="Sender Identity & Provider Readiness",
                        status="passed",
                        detail=f"Verified sender identity: {content.from_name} <{clean_from}>",
                        why_it_matters="Authenticated sender credentials ensure consistent inbox placement.",
                        recommendation="No action needed.",
                        related_step=1,
                        action_label="Review Sender",
                    )
                )

        # From Name check
        if not content.from_name.strip():
            warnings.append("Sender display name is missing.")
            checks.append(
                PreflightCheckItem(
                    id="check_sender_name",
                    category="sender_identity",
                    label="Sender Display Name",
                    status="warning",
                    detail="Display name is blank; recipients will only see raw email address.",
                    why_it_matters="Recipients are far more likely to open messages with clear sender names.",
                    recommendation="Add an organizational or personal display name.",
                    related_step=1,
                    action_label="Review Sender",
                )
            )
        else:
            checks.append(
                PreflightCheckItem(
                    id="check_sender_name",
                    category="sender_identity",
                    label="Sender Display Name",
                    status="passed",
                    detail=f"Display name: '{content.from_name}'",
                    why_it_matters="Recipients are far more likely to open messages with clear sender names.",
                    recommendation="No action needed.",
                    related_step=1,
                    action_label="Review Sender",
                )
            )

        # Reply-To alignment check
        clean_reply = (content.reply_to or "").strip().lower()
        if clean_reply:
            from_domain = clean_from.split("@")[-1] if "@" in clean_from else ""
            reply_domain = clean_reply.split("@")[-1] if "@" in clean_reply else ""
            if from_domain and reply_domain and from_domain != reply_domain:
                checks.append(
                    PreflightCheckItem(
                        id="check_sender_reply_to",
                        category="sender_identity",
                        label="Reply-To Domain Alignment",
                        status="warning",
                        detail=f"Reply-To (@{reply_domain}) does not match From domain (@{from_domain}).",
                        why_it_matters="Divergent Reply-To domains can trigger spoofing heuristic flags in strict filters.",
                        recommendation="Use matching domains or verify DKIM for both domains.",
                        related_step=1,
                        action_label="Review Sender",
                    )
                )
            else:
                checks.append(
                    PreflightCheckItem(
                        id="check_sender_reply_to",
                        category="sender_identity",
                        label="Reply-To Domain Alignment",
                        status="passed",
                        detail=f"Reply-To aligned: {clean_reply}",
                        why_it_matters="Domain alignment reinforces sender legitimacy.",
                        recommendation="No action needed.",
                        related_step=1,
                        action_label="Review Sender",
                    )
                )

    # --------------------------------------------------------------------------
    # 3. Sender Authentication (SPF, DKIM, DMARC)
    # --------------------------------------------------------------------------
    if content:
        clean_from = content.from_email.strip().lower()
        from_domain = clean_from.split("@")[-1] if "@" in clean_from else ""
        from app.services.deliverability.auth_rules import FREE_MAILBOX_DOMAINS
        if from_domain in FREE_MAILBOX_DOMAINS:
            checks.append(
                PreflightCheckItem(
                    id="check_sender_auth_domain",
                    category="sender_auth",
                    label="Domain Authentication (DMARC Policy)",
                    status="warning",
                    detail=f"Sending from free mailbox provider @{from_domain}. May violate DMARC p=reject policies.",
                    why_it_matters="Major providers (Google, Yahoo) reject commercial mail sent from public consumer domains.",
                    recommendation="Use an institutional domain with custom SPF and DKIM records.",
                    related_step=1,
                    action_label="Review Sender",
                )
            )
        else:
            # Check technical findings in report if available
            tech_finding = next((f for f in (report.findings if report else []) if f.rule_code == "AUTH_TECHNICAL_RECORD_ABSENCE"), None)
            if tech_finding and tech_finding.status == "failed":
                checks.append(
                    PreflightCheckItem(
                        id="check_sender_auth_domain",
                        category="sender_auth",
                        label="Domain DNS Authentication (SPF/DMARC)",
                        status="warning",
                        detail=tech_finding.explanation,
                        why_it_matters="SPF and DMARC TXT records are required by receiving mail servers to prevent spoofing.",
                        recommendation="Configure valid v=spf1 and v=DMARC1 records in your domain's DNS.",
                        related_step=1,
                        action_label="Review Sender",
                    )
                )
            elif tech_finding and tech_finding.status == "unknown":
                checks.append(
                    PreflightCheckItem(
                        id="check_sender_auth_domain",
                        category="sender_auth",
                        label="Domain DNS Authentication (SPF/DMARC)",
                        status="unavailable",
                        detail=f"Live DNS query for @{from_domain} unavailable or timed out; technical records could not be verified.",
                        why_it_matters="Authentication cannot be established without live DNS resolution.",
                        recommendation="Verify SPF/DMARC records directly in your domain registrar DNS console.",
                        related_step=1,
                        action_label="Review Sender",
                    )
                )
            else:
                checks.append(
                    PreflightCheckItem(
                        id="check_sender_auth_domain",
                        category="sender_auth",
                        label="Domain Authentication (SPF/DMARC)",
                        status="passed",
                        detail=f"Sender domain @{from_domain} adheres to domain alignment rules.",
                        why_it_matters="Domain alignment prevents spoofing flags.",
                        recommendation="No action needed.",
                        related_step=1,
                        action_label="Review Sender",
                    )
                )

    # --------------------------------------------------------------------------
    # 4. Subject Line
    # --------------------------------------------------------------------------
    if not content or not content.subject.strip():
        blockers.append("Subject line cannot be blank.")
        checks.append(
            PreflightCheckItem(
                id="check_subject_content",
                category="subject_line",
                label="Subject Line Presence",
                status="blocked",
                detail="Email subject is completely empty.",
                why_it_matters="Emails without subjects are immediately flagged as spam or rejected.",
                recommendation="Provide an engaging, professional subject line.",
                related_step=1,
                action_label="Edit Subject",
            )
        )
    else:
        subj = content.subject.strip()
        checks.append(
            PreflightCheckItem(
                id="check_subject_content",
                category="subject_line",
                label="Subject Line Presence",
                status="passed",
                detail=f"Subject: '{subj}'",
                why_it_matters="Subject line accurately set.",
                recommendation="No action needed.",
                related_step=1,
                action_label="Edit Subject",
            )
        )

        # Subject length guidance (20 - 70 chars)
        if len(subj) < 15:
            checks.append(
                PreflightCheckItem(
                    id="check_subject_length",
                    category="subject_line",
                    label="Subject Line Length",
                    status="warning",
                    detail=f"Subject is very brief ({len(subj)} chars). Recommended length is 20-70 characters.",
                    why_it_matters="Short subjects often lack context and have lower open rates.",
                    recommendation="Expand subject line to provide specific context.",
                    related_step=1,
                    action_label="Edit Subject",
                )
            )
        elif len(subj) > 85:
            checks.append(
                PreflightCheckItem(
                    id="check_subject_length",
                    category="subject_line",
                    label="Subject Line Length",
                    status="warning",
                    detail=f"Subject is long ({len(subj)} chars) and may be truncated on mobile devices.",
                    why_it_matters="Mobile clients truncate subjects exceeding 60-70 characters.",
                    recommendation="Keep key message points in the first 50 characters.",
                    related_step=1,
                    action_label="Edit Subject",
                )
            )
        else:
            checks.append(
                PreflightCheckItem(
                    id="check_subject_length",
                    category="subject_line",
                    label="Subject Line Length",
                    status="passed",
                    detail=f"Optimal length ({len(subj)} characters).",
                    why_it_matters="Fits within standard desktop and mobile preview viewports.",
                    recommendation="No action needed.",
                    related_step=1,
                    action_label="Edit Subject",
                )
            )

        # Subject heuristics from report
        subj_findings = [f for f in (report.findings if report else []) if f.rule_code.startswith("SUBJ_") and f.status == "failed"]
        if subj_findings:
            for sf in subj_findings:
                checks.append(
                    PreflightCheckItem(
                        id=f"check_subject_{sf.rule_code.lower()}",
                        category="subject_line",
                        label=sf.title,
                        status="blocked" if sf.severity == "blocker" else "warning",
                        detail=sf.explanation,
                        why_it_matters="Spam filters score aggressive punctuation, capitalization, or fake prefixes heavily.",
                        recommendation=sf.recommendation,
                        related_step=1,
                        action_label="Edit Subject",
                    )
                )

    # --------------------------------------------------------------------------
    # 5. HTML Template & Body Content
    # --------------------------------------------------------------------------
    if not content or not content.html_content.strip():
        blockers.append("Email HTML content cannot be empty.")
        checks.append(
            PreflightCheckItem(
                id="check_html_presence",
                category="html_template",
                label="HTML Email Content",
                status="blocked",
                detail="HTML body content is empty.",
                why_it_matters="Cannot send an empty message.",
                recommendation="Select a template from Template Gallery or write custom HTML in Email Template.",
                related_step=3,
                action_label="Edit Email Template",
            )
        )
    else:
        soup = BeautifulSoup(content.html_content, "html.parser")
        checks.append(
            PreflightCheckItem(
                id="check_html_presence",
                category="html_template",
                label="HTML Email Content",
                status="passed",
                detail=f"HTML content present ({len(content.html_content)} bytes).",
                why_it_matters="Email markup successfully created.",
                recommendation="No action needed.",
                related_step=3,
                action_label="Edit Email Template",
            )
        )

        # Security check: scripts or iframes
        scripts = soup.find_all(["script", "iframe", "object", "embed"])
        if scripts:
            blockers.append("Executable script or iframe tags detected in email HTML.")
            checks.append(
                PreflightCheckItem(
                    id="check_html_security",
                    category="html_template",
                    label="HTML Code Security",
                    status="blocked",
                    detail=f"Forbidden tags detected: <{', <'.join(set(t.name for t in scripts))}>.",
                    why_it_matters="Mail clients quarantine or reject messages containing executable script tags.",
                    recommendation="Remove all script and iframe tags immediately.",
                    related_step=3,
                    action_label="Edit Email Template",
                )
            )
        else:
            checks.append(
                PreflightCheckItem(
                    id="check_html_security",
                    category="html_template",
                    label="HTML Code Security",
                    status="passed",
                    detail="No executable scripts, iframes, or unsafe objects detected.",
                    why_it_matters="Safe code structure ensures client acceptance.",
                    recommendation="No action needed.",
                    related_step=3,
                    action_label="Edit Email Template",
                )
            )

        # Plain text multipart alternative
        if not content.plain_text or not content.plain_text.strip():
            checks.append(
                PreflightCheckItem(
                    id="check_plain_text",
                    category="html_template",
                    label="Plain-Text Multipart Alternative",
                    status="warning",
                    detail="No plain-text alternative provided alongside HTML content.",
                    why_it_matters="Multipart MIME emails with plain-text versions achieve superior inbox delivery.",
                    recommendation="Provide a clean plain-text copy in the email editor.",
                    related_step=3,
                    action_label="Edit Email Template",
                )
            )
        else:
            checks.append(
                PreflightCheckItem(
                    id="check_plain_text",
                    category="html_template",
                    label="Plain-Text Multipart Alternative",
                    status="passed",
                    detail="Plain-text alternative provided.",
                    why_it_matters="Ensures compatibility for text-only clients.",
                    recommendation="No action needed.",
                    related_step=3,
                    action_label="Edit Email Template",
                )
            )

    # --------------------------------------------------------------------------
    # 6. Links Safety
    # --------------------------------------------------------------------------
    if content and content.html_content:
        link_findings = [f for f in (report.findings if report else []) if f.category == "html_links" and "LINK" in f.rule_code and f.status == "failed"]
        if link_findings:
            for lf in link_findings:
                checks.append(
                    PreflightCheckItem(
                        id=f"check_link_{lf.rule_code.lower()}",
                        category="links",
                        label=lf.title,
                        status="blocked" if lf.severity == "blocker" else "warning",
                        detail=lf.explanation,
                        why_it_matters="Deceptive, shortener, or raw IP links trigger immediate phishing alarms.",
                        recommendation=lf.recommendation,
                        related_step=3,
                        action_label="Review Links",
                    )
                )
        else:
            checks.append(
                PreflightCheckItem(
                    id="check_safe_links",
                    category="links",
                    label="Hyperlink Safety & Destination Alignment",
                    status="passed",
                    detail="All links point to valid domain destinations without shorteners or mismatches.",
                    why_it_matters="Legitimate destination URLs safeguard domain reputation.",
                    recommendation="No action needed.",
                    related_step=3,
                    action_label="Review Links",
                )
            )

    # --------------------------------------------------------------------------
    # 7. Personalization & Unsubscribe Compliance
    # --------------------------------------------------------------------------
    if content:
        combined = f"{content.subject} {content.preview_text or ''} {content.html_content}"
        # Token malformed check
        open_unclosed = re.findall(r"\{\{[a-zA-Z0-9_\s]+(?!\}\})", combined)
        properly_closed = set(re.findall(r"\{\{[a-zA-Z0-9_\s\|]+\}\}", combined))
        malformed = [m for m in open_unclosed if not any(m in p for p in properly_closed)]
        if malformed:
            checks.append(
                PreflightCheckItem(
                    id="check_personalization_syntax",
                    category="personalization",
                    label="Personalization Token Syntax",
                    status="blocked",
                    detail=f"Malformed placeholder syntax detected: {', '.join(malformed[:3])}",
                    why_it_matters="Recipients will see broken placeholders instead of personalized values.",
                    recommendation="Ensure all tokens follow double-curly syntax: {{variable}}.",
                    related_step=3,
                    action_label="Edit Email Template",
                )
            )
        else:
            checks.append(
                PreflightCheckItem(
                    id="check_personalization_syntax",
                    category="personalization",
                    label="Personalization Token Syntax",
                    status="passed",
                    detail="All personalization tokens follow valid double-curly syntax.",
                    why_it_matters="Ensures seamless interpolation of recipient data.",
                    recommendation="No action needed.",
                    related_step=3,
                    action_label="Edit Email Template",
                )
            )

        # Unsubscribe token check
        unsub_finding = next((f for f in (report.findings if report else []) if f.rule_code == "COMPL_MISSING_UNSUBSCRIBE" and f.status == "failed"), None)
        if unsub_finding:
            checks.append(
                PreflightCheckItem(
                    id="check_compliance_unsubscribe",
                    category="personalization",
                    label="Mandatory Unsubscribe Mechanism",
                    status="blocked",
                    detail=unsub_finding.explanation,
                    why_it_matters="Mandatory under CAN-SPAM, GDPR, and mailbox provider policies.",
                    recommendation=unsub_finding.recommendation,
                    related_step=3,
                    action_label="Edit Email Template",
                )
            )
        else:
            checks.append(
                PreflightCheckItem(
                    id="check_compliance_unsubscribe",
                    category="personalization",
                    label="Mandatory Unsubscribe Mechanism",
                    status="passed",
                    detail="Explicit opt-out / unsubscribe link present in email body.",
                    why_it_matters="Complies with international spam regulations.",
                    recommendation="No action needed.",
                    related_step=3,
                    action_label="Edit Email Template",
                )
            )

    # --------------------------------------------------------------------------
    # 8. Rendering & Viewport Simulation
    # --------------------------------------------------------------------------
    if content and content.html_content:
        has_viewport = "<meta" in content.html_content.lower() and "viewport" in content.html_content.lower()
        if not has_viewport:
            checks.append(
                PreflightCheckItem(
                    id="check_rendering_viewport",
                    category="rendering",
                    label="Mobile Viewport Responsiveness",
                    status="warning",
                    detail="Missing <meta name='viewport'> tag; mobile clients may render full desktop scale.",
                    why_it_matters="Ensures email reflows cleanly on smartphone screens.",
                    recommendation="Include a viewport meta tag in the email head.",
                    related_step=3,
                    action_label="Edit Email Template",
                )
            )
        else:
            checks.append(
                PreflightCheckItem(
                    id="check_rendering_viewport",
                    category="rendering",
                    label="Mobile Viewport Responsiveness",
                    status="passed",
                    detail="Responsive mobile viewport tag configured.",
                    why_it_matters="Supports adaptive layouts across devices.",
                    recommendation="No action needed.",
                    related_step=3,
                    action_label="Edit Email Template",
                )
            )

    # --------------------------------------------------------------------------
    # 9. Audience Readiness
    # --------------------------------------------------------------------------
    total_unique, eligible_count = snapshot_campaign_recipients(db, campaign_id)
    if eligible_count == 0:
        blockers.append("Audience list contains 0 eligible contacts. Select at least one list with qualified contacts.")
        checks.append(
            PreflightCheckItem(
                id="check_audience_eligibility",
                category="audience_readiness",
                label="Recipient Audience Readiness",
                status="blocked",
                detail="No eligible unique contacts found in selected contact lists.",
                why_it_matters="Outreach requires at least one verified qualified recipient.",
                recommendation="Select a contact list containing verified, non-suppressed contacts.",
                related_step=2,
                action_label="Change Audience",
            )
        )
    else:
        checks.append(
            PreflightCheckItem(
                id="check_audience_eligibility",
                category="audience_readiness",
                label="Recipient Audience Readiness",
                status="passed",
                detail=f"{eligible_count} verified, eligible unique contacts ready for dispatch.",
                why_it_matters="Targeted audience verified against opt-outs and suppression.",
                recommendation="No action needed.",
                related_step=2,
                action_label="Change Audience",
            )
        )

    # --------------------------------------------------------------------------
    # 10. Scheduling & Delivery Timing
    # --------------------------------------------------------------------------
    if campaign.scheduled_at:
        now_utc = _utc_now()
        if campaign.scheduled_at <= now_utc:
            blockers.append("Scheduled dispatch date is in the past.")
            checks.append(
                PreflightCheckItem(
                    id="check_scheduling_timing",
                    category="scheduling",
                    label="Delivery Schedule Configuration",
                    status="blocked",
                    detail=f"Scheduled time ({campaign.scheduled_at.isoformat()}) has already elapsed.",
                    why_it_matters="Future scheduling requires a future date/time timestamp.",
                    recommendation="Set a future date and time in When to Send.",
                    related_step=4,
                    action_label="Edit Schedule",
                )
            )
        else:
            checks.append(
                PreflightCheckItem(
                    id="check_scheduling_timing",
                    category="scheduling",
                    label="Delivery Schedule Configuration",
                    status="passed",
                    detail=f"Scheduled for future dispatch at {campaign.scheduled_at.isoformat()} ({campaign.timezone_name}).",
                    why_it_matters="Compatible with background job execution engine.",
                    recommendation="No action needed.",
                    related_step=4,
                    action_label="Edit Schedule",
                )
            )
    else:
        checks.append(
            PreflightCheckItem(
                id="check_scheduling_timing",
                category="scheduling",
                label="Delivery Schedule Configuration",
                status="passed",
                detail="Immediate dispatch upon confirmed launch.",
                why_it_matters="Immediate execution executes through active SMTP pipeline.",
                recommendation="No action needed.",
                related_step=4,
                action_label="Edit Schedule",
            )
        )

    # --------------------------------------------------------------------------
    # 11. Rule-Based Deliverability Report Check
    # --------------------------------------------------------------------------
    if not report:
        blockers.append("Deliverability analysis has not been executed. Run rule-based analysis before launching.")
        checks.append(
            PreflightCheckItem(
                id="check_deliverability_report",
                category="deliverability",
                label="Rule-Based Spam Risk Report",
                status="blocked",
                detail="No analysis report found for this campaign.",
                why_it_matters="Preflight quality assurance verifies compliance prior to launch.",
                recommendation="Execute Placement Analysis before launch.",
                related_step=5,
                action_label="Run Analysis",
            )
        )
    elif report.is_stale:
        blockers.append("Content was modified since the last deliverability report. Re-run analysis on the latest version.")
        checks.append(
            PreflightCheckItem(
                id="check_deliverability_report",
                category="deliverability",
                label="Rule-Based Spam Risk Report",
                status="blocked",
                detail="Report is stale (content was edited after analysis).",
                why_it_matters="Analysis must evaluate the exact content scheduled for dispatch.",
                recommendation="Re-run Placement Analysis on current draft.",
                related_step=5,
                action_label="Re-run Analysis",
            )
        )
    elif report.has_blockers:
        blocker_titles = [f.title for f in report.findings if f.severity == "blocker" and f.status == "failed"]
        for b in blocker_titles:
            blockers.append(f"Deliverability Blocker: {b}")
        checks.append(
            PreflightCheckItem(
                id="check_deliverability_report",
                category="deliverability",
                label="Rule-Based Spam Risk Report",
                status="blocked",
                detail=f"Blocked due to critical deliverability violations: {', '.join(blocker_titles)}",
                why_it_matters="Blockers represent high-risk violations guaranteed to harm domain reputation.",
                recommendation="Resolve the flagged blockers in Placement Analysis.",
                related_step=5,
                action_label="Review Findings",
            )
        )
    elif report.risk_level in {"high", "critical"}:
        warnings.append(
            f"Campaign has an elevated spam risk score ({report.risk_score}/100 - {report.risk_level.title()}). Review recommendations."
        )
        checks.append(
            PreflightCheckItem(
                id="check_deliverability_report",
                category="deliverability",
                label="Rule-Based Spam Risk Report",
                status="warning",
                detail=f"Risk score is {report.risk_score} ({report.risk_level}). Corrective actions recommended.",
                why_it_matters="Elevated scores reduce inbox placement probability.",
                recommendation="Review Placement Analysis recommendations to lower spam risk.",
                related_step=5,
                action_label="Review Findings",
            )
        )
    else:
        checks.append(
            PreflightCheckItem(
                id="check_deliverability_report",
                category="deliverability",
                label="Rule-Based Spam Risk Report",
                status="passed",
                detail=f"Passed with {report.risk_level.title()} risk score ({report.risk_score}/100).",
                why_it_matters="Content complies with anti-spam heuristic standards.",
                recommendation="No action needed.",
                related_step=5,
                action_label="Review Findings",
            )
        )

    # --------------------------------------------------------------------------
    # 12. ML Placement Prediction Check (Non-blocking)
    # --------------------------------------------------------------------------
    if prediction and prediction.status == "available":
        prob_pct = round((prediction.inbox_probability or 0.0) * 100, 1)
        checks.append(
            PreflightCheckItem(
                id="check_ml_placement_forecast",
                category="ml_prediction",
                label="Machine Learning Placement Estimate",
                status="passed",
                detail=f"Model {prediction.model_version} estimates {prob_pct}% Inbox probability ({prediction.risk_tier}).",
                why_it_matters="Supervised statistical forecast based on calibrated outreach models.",
                recommendation="Review top predictive factors in Placement Analysis.",
                related_step=5,
                action_label="View ML Forecast",
            )
        )
    else:
        checks.append(
            PreflightCheckItem(
                id="check_ml_placement_forecast",
                category="ml_prediction",
                label="Machine Learning Placement Estimate",
                status="unavailable",
                detail="ML model prediction is unavailable. (Model gated until validated test data is active).",
                why_it_matters="Statistical forecasting requires an active approved model.",
                recommendation="Ensure a calibrated model is active in the ML model registry.",
                related_step=5,
                action_label="View ML Forecast",
            )
        )

    can_schedule_or_send = len(blockers) == 0
    requires_ack = len(warnings) > 0

    return CampaignPreflightResponse(
        campaign_id=campaign_id,
        is_ready=can_schedule_or_send and not requires_ack,
        can_schedule_or_send=can_schedule_or_send,
        requires_warning_acknowledgement=requires_ack,
        blockers=blockers,
        warnings=warnings,
        checks=checks,
        deliverability_report=report,
        placement_test=placement,
        ml_prediction=prediction,
    )


def execute_campaign_dispatch_or_schedule(
    db: Session,
    campaign_id: int,
    schedule_payload: CampaignScheduleRequest,
    confirm_payload: CampaignConfirmSendRequest,
) -> Campaign:
    """Orchestrates final pre-launch checks, re-verifies contact eligibility,

    and performs dispatch or future scheduling idempotently.
    """
    campaign = get_campaign_by_id(db, campaign_id)
    if not campaign:
        raise ValueError(f"Campaign {campaign_id} not found.")

    if campaign.status in {"sent", "sending", "archived"}:
        raise ValueError(f"Cannot dispatch campaign in '{campaign.status}' status.")

    if not confirm_payload.confirmed:
        raise ValueError("Explicit user confirmation is mandatory to launch or schedule a campaign.")

    # Run preflight evaluation
    preflight = evaluate_campaign_preflight(db, campaign_id)
    if not preflight.can_schedule_or_send:
        raise ValueError(f"Cannot launch campaign: {'; '.join(preflight.blockers)}")

    if preflight.requires_warning_acknowledgement and not confirm_payload.bypass_warnings:
        raise ValueError(
            f"Campaign has active warnings: {'; '.join(preflight.warnings)}. "
            "Please acknowledge warnings to proceed."
        )

    # Recheck suppression and eligibility of each recipient snapshot at dispatch time
    snapshots = list(
        db.scalars(
            select(CampaignRecipientSnapshot).where(
                CampaignRecipientSnapshot.campaign_id == campaign_id
            )
        ).all()
    )

    eligible_snapshots = []
    for s in snapshots:
        lead = db.get(Lead, s.lead_id) if s.lead_id else None
        if lead and is_lead_eligible_contact(lead):
            eligible_snapshots.append(s)
        else:
            s.status = "suppressed"
            s.error_message = "Lead no longer meets eligibility or qualification criteria at dispatch time."

    if not eligible_snapshots:
        raise ValueError("No eligible recipients remain after dispatch-time suppression recheck.")

    now = _utc_now()

    if schedule_payload.send_immediately:
        campaign.status = "sending"
        campaign.total_recipients = len(snapshots)
        db.flush()
        # Execute real delivery through EmailDeliveryService
        dispatch_campaign_messages(db, campaign_id)
    else:
        # Schedule for future
        if not schedule_payload.scheduled_at:
            raise ValueError("A future date and time is required when scheduling a campaign.")

        target_time = schedule_payload.scheduled_at
        if target_time.tzinfo is None:
            target_time = target_time.replace(tzinfo=timezone.utc)

        if target_time <= now:
            raise ValueError("Scheduled time must be in the future.")

        campaign.status = "scheduled"
        campaign.scheduled_at = target_time
        campaign.timezone_name = schedule_payload.timezone_name or "UTC"
        campaign.total_recipients = len(snapshots)

    db.flush()
    return campaign


def render_personalized_content(
    html_content: str,
    plain_text: str | None,
    subject: str,
    lead: Lead | None,
    recipient_email: str,
    recipient_name: str | None,
    campaign_id: int,
    snapshot_id: int,
) -> tuple[str, str, str]:
    """Personalizes subject, HTML, and plain text with recipient tokens,

    sanitizes markup, injects open tracking pixel, and rewrites URLs for click tracking.
    """
    clean_name = (recipient_name or (lead.name if lead else None) or "Colleague").strip()
    first_name = clean_name.split()[0] if clean_name else "Colleague"
    clean_email = recipient_email.strip()
    university = (lead.university if lead else None) or "your institution"
    department = (lead.department if lead else None) or "your department"
    country = (lead.country if lead else None) or ""
    profession = (lead.profession if lead else None) or "Researcher"
    unsubscribe_url = f"/api/campaigns/{campaign_id}/unsubscribe?email={urllib.parse.quote(clean_email)}"

    tokens = {
        "name": clean_name,
        "first_name": first_name,
        "email": clean_email,
        "university": university,
        "institution": university,
        "department": department,
        "country": country,
        "profession": profession,
        "title": profession,
        "unsubscribe_url": unsubscribe_url,
    }

    def _replace_tokens(text: str) -> str:
        if not text:
            return ""

        def _token_match(m):
            token_key = m.group(1).strip()
            fallback = m.group(2).strip() if m.group(2) else ""
            if token_key in tokens and tokens[token_key]:
                return tokens[token_key]
            return fallback or tokens.get(token_key, "")

        pattern = r"\{\{\s*([a-zA-Z0-9_]+)(?:\|([^}]+))?\s*\}\}"
        return re.sub(pattern, _token_match, text)

    rendered_subject = _replace_tokens(subject)
    rendered_plain = _replace_tokens(plain_text or "")
    rendered_html = _replace_tokens(html_content)

    # Sanitize HTML: remove dangerous tags like <script>
    soup = BeautifulSoup(rendered_html, "html.parser")
    for s in soup(["script", "iframe", "object", "embed"]):
        s.decompose()

    # Rewrite anchor links for click tracking
    for a in soup.find_all("a", href=True):
        href = a["href"].strip()
        if href.startswith("http://") or href.startswith("https://"):
            if "unsubscribe" not in href.lower() and "/track/click/" not in href:
                tracked_url = f"/api/campaigns/{campaign_id}/track/click/{snapshot_id}?url={urllib.parse.quote(href)}"
                a["href"] = tracked_url

    # Inject open tracking pixel at the end of the body
    open_pixel = soup.new_tag(
        "img",
        src=f"/api/campaigns/{campaign_id}/track/open/{snapshot_id}",
        width="1",
        height="1",
        alt="",
        style="display:none;width:1px;height:1px;border:0;",
    )
    if soup.body:
        soup.body.append(open_pixel)
    else:
        soup.append(open_pixel)

    final_html = str(soup)
    return rendered_subject, final_html, rendered_plain


def dispatch_campaign_messages(
    db: Session,
    campaign_id: int,
    delivery_service: EmailDeliveryService | None = None,
) -> Campaign:
    """Dispatches all eligible pending recipient snapshots through the real email delivery service.

    Safely handles live pauses, cancellations, per-recipient provider results, and state updates.
    """
    campaign = db.get(Campaign, campaign_id)
    if not campaign:
        raise ValueError(f"Campaign {campaign_id} not found.")

    service = delivery_service or EmailDeliveryService()
    latest_content = get_latest_campaign_content(db, campaign_id)
    if not latest_content:
        campaign.status = "failed"
        db.flush()
        raise ValueError("Campaign has no email content to dispatch.")

    from_email = latest_content.from_email.strip()
    from_name = latest_content.from_name.strip() or "Sitech Series"
    reply_to = (latest_content.reply_to or "").strip() or None

    # Retrieve associated email account if present
    if campaign.email_account_id:
        acc = db.get(EmailAccount, campaign.email_account_id)
        if acc:
            if acc.archived_at is not None or not acc.is_active:
                campaign.status = "failed"
                db.flush()
                raise ValueError("Configured email account is archived or inactive.")
            if not reply_to:
                reply_to = acc.reply_to or acc.receiver_email or acc.email_address

    # Fetch pending snapshots
    pending_snapshots = list(
        db.scalars(
            select(CampaignRecipientSnapshot)
            .where(
                CampaignRecipientSnapshot.campaign_id == campaign_id,
                CampaignRecipientSnapshot.status == "pending",
            )
            .order_by(CampaignRecipientSnapshot.id.asc())
        ).all()
    )

    if not pending_snapshots:
        # Check if all were already processed
        all_snaps = list(
            db.scalars(
                select(CampaignRecipientSnapshot).where(
                    CampaignRecipientSnapshot.campaign_id == campaign_id
                )
            ).all()
        )
        sent_any = any(s.status in {"sent", "delivered"} for s in all_snaps)
        campaign.status = "sent" if sent_any else "failed"
        db.flush()
        return campaign

    now = _utc_now()
    sent_count = campaign.sent_count
    delivered_count = campaign.delivered_count
    bounced_count = campaign.bounced_count
    from_domain = from_email.split("@")[-1] if "@" in from_email else "sitechseries.org"

    for snapshot in pending_snapshots:
        # Re-check campaign status on each iteration to respect live pauses or cancellations
        db.refresh(campaign)
        if campaign.status in {"paused", "cancelled"}:
            logger.info("Halting dispatch for campaign %d: Status changed to %s", campaign_id, campaign.status)
            break

        # Suppression & qualification recheck at dispatch time
        lead = db.get(Lead, snapshot.lead_id) if snapshot.lead_id else None
        if lead and not is_lead_eligible_contact(lead):
            snapshot.status = "suppressed"
            snapshot.error_message = "Lead no longer meets eligibility or qualification criteria at dispatch time."
            snapshot.dispatch_attempt_at = _utc_now()
            db.flush()
            continue


        # Personalize content
        subj, html_body, plain_body = render_personalized_content(
            html_content=latest_content.html_content,
            plain_text=latest_content.plain_text,
            subject=latest_content.subject,
            lead=lead,
            recipient_email=snapshot.normalized_email,
            recipient_name=snapshot.name,
            campaign_id=campaign_id,
            snapshot_id=snapshot.id,
        )

        msg_id = f"<{campaign_id}.{snapshot.id}.{int(_utc_now().timestamp())}@{from_domain}>"
        headers = {
            "List-Unsubscribe": f"<https://sitechseries.org/api/campaigns/{campaign_id}/unsubscribe?email={urllib.parse.quote(snapshot.normalized_email)}>",
            "X-Campaign-ID": str(campaign_id),
            "X-Recipient-ID": str(snapshot.id),
        }

        # Dispatch via real delivery service
        success, provider_msg_id, provider_status_msg = service.send_campaign_email(
            from_name=from_name,
            from_email=from_email,
            recipient_email=snapshot.normalized_email,
            recipient_name=snapshot.name,
            subject=subj,
            html_content=html_body,
            plain_text=plain_body,
            reply_to=reply_to,
            message_id=msg_id,
            headers=headers,
        )

        dispatch_time = _utc_now()
        snapshot.dispatch_attempt_at = dispatch_time

        if success:
            snapshot.status = "sent"
            snapshot.provider_message_id = provider_msg_id or msg_id
            snapshot.delivered_at = dispatch_time
            snapshot.error_message = None
            sent_count += 1
            delivered_count += 1
        else:
            if "refused" in provider_status_msg.lower() or "rejected" in provider_status_msg.lower():
                snapshot.status = "bounced"
                snapshot.bounced_at = dispatch_time
                snapshot.bounce_reason = provider_status_msg
                bounced_count += 1
                from app.services.campaign_tracking_service import classify_bounce
                snapshot.bounce_type = classify_bounce(provider_status_msg)
            else:
                snapshot.status = "failed"
                snapshot.error_message = provider_status_msg

        # Flush per recipient to maintain consistent database state
        db.flush()

    # Re-fetch campaign status before finalizing
    db.refresh(campaign)
    if campaign.status not in {"paused", "cancelled"}:
        if sent_count > 0:
            campaign.status = "sent"
            campaign.sent_at = _utc_now()
        else:
            campaign.status = "failed"

    campaign.sent_count = sent_count
    campaign.delivered_count = delivered_count
    campaign.bounced_count = bounced_count
    db.flush()
    return campaign


def process_due_scheduled_campaigns(db: Session, max_campaigns: int = 5) -> list[int]:
    """Scans and safely claims due scheduled campaigns and processes their dispatch.

    Atomic status transition guarantees concurrency safety across multiple workers.
    """
    now = _utc_now()
    due_campaign_ids = list(
        db.scalars(
            select(Campaign.id)
            .where(
                Campaign.status == "scheduled",
                Campaign.scheduled_at <= now,
            )
            .order_by(Campaign.scheduled_at.asc())
            .limit(max_campaigns)
        ).all()
    )

    claimed_ids = []
    for cid in due_campaign_ids:
        # Atomic claim: update status to 'sending' ONLY if still 'scheduled'
        campaign = db.get(Campaign, cid)
        if not campaign or campaign.status != "scheduled":
            continue

        campaign.status = "sending"
        db.commit()
        claimed_ids.append(cid)

        try:
            dispatch_campaign_messages(db, cid)
            db.commit()
        except Exception as exc:
            db.rollback()
            logger.error("Error processing scheduled campaign %d: %s", cid, exc)
            err_camp = db.get(Campaign, cid)
            if err_camp and err_camp.status == "sending":
                err_camp.status = "failed"
                db.commit()

    return claimed_ids
