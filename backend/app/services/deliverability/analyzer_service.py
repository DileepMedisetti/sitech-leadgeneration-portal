import math
from datetime import datetime, timezone
from typing import Any
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.models.campaign import Campaign, CampaignContent
from app.models.deliverability import DeliverabilityReport
from app.repositories.campaign_repository import (
    compute_content_fingerprint,
    get_campaign_by_id,
    get_latest_campaign_content,
)
from app.schemas.deliverability import (
    AnalyzeContentRequest,
    DeliverabilityFinding,
    DeliverabilityReportResponse,
    ReportComparisonResponse,
    RiskLevel,
)
from app.services.deliverability.auth_rules import evaluate_auth_rules
from app.services.deliverability.compliance_rules import evaluate_compliance_rules
from app.services.deliverability.content_rules import evaluate_content_rules
from app.services.deliverability.html_rules import evaluate_html_rules
from app.services.deliverability.rules_config import RULE_CONFIG
from app.services.deliverability.token_rules import evaluate_token_rules


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def analyze_email_content(
    subject: str,
    preview_text: str | None,
    from_name: str,
    from_email: str,
    reply_to: str | None,
    html_content: str,
    plain_text: str | None,
    unsubscribe_url: str | None = None,
) -> tuple[float, RiskLevel, list[DeliverabilityFinding], dict[str, float], bool]:
    """Evaluates all deliverability rule categories, computes weighted risk score and level."""
    findings: list[DeliverabilityFinding] = []

    # 1. Content and subject rules
    findings.extend(
        evaluate_content_rules(
            subject=subject,
            preview_text=preview_text,
            html_content=html_content,
            plain_text=plain_text,
        )
    )

    # 2. Token rules
    findings.extend(
        evaluate_token_rules(
            subject=subject,
            preview_text=preview_text,
            html_content=html_content,
            plain_text=plain_text,
        )
    )

    # 3. HTML and links rules
    findings.extend(
        evaluate_html_rules(
            html_content=html_content,
            plain_text=plain_text,
        )
    )

    # 4. Authentication and sender domain rules
    findings.extend(
        evaluate_auth_rules(
            from_email=from_email,
            reply_to=reply_to,
        )
    )

    # 5. Compliance rules
    findings.extend(
        evaluate_compliance_rules(
            html_content=html_content,
            plain_text=plain_text,
            unsubscribe_url=unsubscribe_url,
        )
    )

    # Deduplicate findings by rule_code
    deduped_failed: dict[str, DeliverabilityFinding] = {}
    for f in findings:
        if f.rule_code not in deduped_failed:
            deduped_failed[f.rule_code] = f

    # Generate passed findings for rules that had no violations
    all_findings: list[DeliverabilityFinding] = []
    category_scores: dict[str, float] = {
        "content": 0.0,
        "personalization": 0.0,
        "html_links": 0.0,
        "authentication": 0.0,
        "compliance": 0.0,
    }

    raw_score = 0.0
    has_blockers = False

    for rule_code, cfg in RULE_CONFIG.items():
        if rule_code in deduped_failed:
            failed_finding = deduped_failed[rule_code]
            all_findings.append(failed_finding)
            raw_score += failed_finding.risk_points
            category_scores[cfg["category"]] += failed_finding.risk_points
            if failed_finding.severity == "blocker":
                has_blockers = True
        else:
            all_findings.append(
                DeliverabilityFinding(
                    rule_code=rule_code,
                    category=cfg["category"],
                    severity=cfg["severity"],
                    title=cfg["title"],
                    explanation="No violations detected for this rule.",
                    recommendation=cfg["recommendation"],
                    status="passed",
                    risk_points=0.0,
                )
            )

    # Normalized risk score: 0 to 100
    risk_score = min(100.0, round(raw_score, 1))

    if has_blockers or risk_score >= 75.0:
        risk_level: RiskLevel = "critical"
    elif risk_score >= 50.0:
        risk_level = "high"
    elif risk_score >= 25.0:
        risk_level = "medium"
    else:
        risk_level = "low"

    return risk_score, risk_level, all_findings, category_scores, has_blockers


def run_campaign_deliverability_analysis(
    db: Session,
    campaign_id: int,
) -> DeliverabilityReportResponse:
    """Runs a fresh analysis on the campaign's current content snapshot and persists the report."""
    campaign = get_campaign_by_id(db, campaign_id)
    if not campaign:
        raise ValueError(f"Campaign {campaign_id} not found.")

    content = get_latest_campaign_content(db, campaign_id)
    if not content:
        raise ValueError("Campaign does not have any saved email content to analyze.")

    risk_score, risk_level, findings, category_scores, has_blockers = analyze_email_content(
        subject=content.subject,
        preview_text=content.preview_text,
        from_name=content.from_name,
        from_email=content.from_email,
        reply_to=content.reply_to,
        html_content=content.html_content,
        plain_text=content.plain_text,
    )

    failed_count = sum(1 for f in findings if f.status == "failed")
    passed_count = sum(1 for f in findings if f.status == "passed")
    unknown_count = sum(1 for f in findings if f.status == "unknown")

    report = DeliverabilityReport(
        campaign_id=campaign_id,
        content_version=content.version,
        content_fingerprint=content.content_fingerprint,
        rule_set_version="1.0.0",
        risk_score=risk_score,
        risk_level=risk_level,
        findings_count=len(findings),
        passed_count=passed_count,
        failed_count=failed_count,
        unknown_count=unknown_count,
        has_blockers=has_blockers,
        category_scores=category_scores,
        findings_json=[f.model_dump() for f in findings],
    )
    db.add(report)
    db.flush()

    return DeliverabilityReportResponse(
        id=report.id,
        campaign_id=campaign_id,
        content_version=content.version,
        content_fingerprint=content.content_fingerprint,
        rule_set_version="1.0.0",
        risk_score=risk_score,
        risk_level=risk_level,
        findings_count=len(findings),
        passed_count=passed_count,
        failed_count=failed_count,
        unknown_count=unknown_count,
        has_blockers=has_blockers,
        is_stale=False,
        findings=findings,
        category_scores=category_scores,
        created_at=report.created_at,
    )


def get_latest_campaign_report(
    db: Session, campaign_id: int
) -> DeliverabilityReportResponse | None:
    """Retrieve the most recent deliverability report for a campaign, flagging whether it is stale."""
    content = get_latest_campaign_content(db, campaign_id)
    if not content:
        return None

    stmt = (
        select(DeliverabilityReport)
        .where(DeliverabilityReport.campaign_id == campaign_id)
        .order_by(desc(DeliverabilityReport.created_at))
        .limit(1)
    )
    report = db.scalar(stmt)
    if not report:
        return None

    is_stale = report.content_fingerprint != content.content_fingerprint

    findings = [DeliverabilityFinding(**f) for f in report.findings_json]

    return DeliverabilityReportResponse(
        id=report.id,
        campaign_id=report.campaign_id,
        content_version=report.content_version,
        content_fingerprint=report.content_fingerprint,
        rule_set_version=report.rule_set_version,
        risk_score=report.risk_score,
        risk_level=report.risk_level,
        findings_count=report.findings_count,
        passed_count=report.passed_count,
        failed_count=report.failed_count,
        unknown_count=report.unknown_count,
        has_blockers=report.has_blockers,
        is_stale=is_stale,
        findings=findings,
        category_scores=report.category_scores,
        created_at=report.created_at,
    )


def get_campaign_reports_history(
    db: Session, campaign_id: int, limit: int = 10
) -> list[DeliverabilityReportResponse]:
    stmt = (
        select(DeliverabilityReport)
        .where(DeliverabilityReport.campaign_id == campaign_id)
        .order_by(desc(DeliverabilityReport.created_at))
        .limit(limit)
    )
    rows = list(db.scalars(stmt).all())
    content = get_latest_campaign_content(db, campaign_id)
    current_fp = content.content_fingerprint if content else ""

    history = []
    for report in rows:
        findings = [DeliverabilityFinding(**f) for f in report.findings_json]
        history.append(
            DeliverabilityReportResponse(
                id=report.id,
                campaign_id=report.campaign_id,
                content_version=report.content_version,
                content_fingerprint=report.content_fingerprint,
                rule_set_version=report.rule_set_version,
                risk_score=report.risk_score,
                risk_level=report.risk_level,
                findings_count=report.findings_count,
                passed_count=report.passed_count,
                failed_count=report.failed_count,
                unknown_count=report.unknown_count,
                has_blockers=report.has_blockers,
                is_stale=(report.content_fingerprint != current_fp),
                findings=findings,
                category_scores=report.category_scores,
                created_at=report.created_at,
            )
        )
    return history


def compare_deliverability_reports(
    db: Session, report_id_a: int, report_id_b: int
) -> ReportComparisonResponse:
    report_a = db.get(DeliverabilityReport, report_id_a)
    report_b = db.get(DeliverabilityReport, report_id_b)
    if not report_a or not report_b:
        raise ValueError("One or both reports not found.")

    resp_a = DeliverabilityReportResponse(
        id=report_a.id,
        campaign_id=report_a.campaign_id,
        content_version=report_a.content_version,
        content_fingerprint=report_a.content_fingerprint,
        rule_set_version=report_a.rule_set_version,
        risk_score=report_a.risk_score,
        risk_level=report_a.risk_level,
        findings_count=report_a.findings_count,
        passed_count=report_a.passed_count,
        failed_count=report_a.failed_count,
        unknown_count=report_a.unknown_count,
        has_blockers=report_a.has_blockers,
        findings=[DeliverabilityFinding(**f) for f in report_a.findings_json],
        category_scores=report_a.category_scores,
        created_at=report_a.created_at,
    )
    resp_b = DeliverabilityReportResponse(
        id=report_b.id,
        campaign_id=report_b.campaign_id,
        content_version=report_b.content_version,
        content_fingerprint=report_b.content_fingerprint,
        rule_set_version=report_b.rule_set_version,
        risk_score=report_b.risk_score,
        risk_level=report_b.risk_level,
        findings_count=report_b.findings_count,
        passed_count=report_b.passed_count,
        failed_count=report_b.failed_count,
        unknown_count=report_b.unknown_count,
        has_blockers=report_b.has_blockers,
        findings=[DeliverabilityFinding(**f) for f in report_b.findings_json],
        category_scores=report_b.category_scores,
        created_at=report_b.created_at,
    )

    failed_a = {f.rule_code for f in resp_a.findings if f.status == "failed"}
    failed_b = {f.rule_code for f in resp_b.findings if f.status == "failed"}

    fixed = list(failed_a - failed_b)
    new_findings = list(failed_b - failed_a)
    delta = round(report_b.risk_score - report_a.risk_score, 1)

    return ReportComparisonResponse(
        campaign_id=report_a.campaign_id,
        report_a=resp_a,
        report_b=resp_b,
        score_delta=delta,
        fixed_findings=fixed,
        new_findings=new_findings,
    )
