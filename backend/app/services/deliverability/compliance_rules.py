import re
from bs4 import BeautifulSoup
from app.schemas.deliverability import DeliverabilityFinding
from app.services.deliverability.rules_config import RULE_CONFIG


def evaluate_compliance_rules(
    html_content: str,
    plain_text: str | None,
    unsubscribe_url: str | None,
) -> list[DeliverabilityFinding]:
    findings: list[DeliverabilityFinding] = []

    combined_text = f"{html_content} {plain_text or ''}".lower()

    # Rule 1: COMPL_MISSING_UNSUBSCRIBE (Blocker)
    has_unsub = False
    if unsubscribe_url and unsubscribe_url.strip():
        has_unsub = True
    elif "{{unsubscribe_url}}" in combined_text or "{{ unsubscribe_url }}" in combined_text:
        has_unsub = True
    else:
        # Check for link text or href with unsubscribe / opt-out
        soup = BeautifulSoup(html_content, "html.parser")
        for a in soup.find_all("a"):
            text = a.get_text().lower()
            href = a.get("href", "").lower()
            if "unsubscribe" in text or "opt out" in text or "opt-out" in text or "unsubscribe" in href:
                has_unsub = True
                break

    if not has_unsub:
        cfg = RULE_CONFIG["COMPL_MISSING_UNSUBSCRIBE"]
        findings.append(
            DeliverabilityFinding(
                rule_code="COMPL_MISSING_UNSUBSCRIBE",
                category=cfg["category"],
                severity=cfg["severity"],
                title=cfg["title"],
                explanation=cfg["explanation"],
                recommendation=cfg["recommendation"],
                status="failed",
                risk_points=cfg["risk_points"],
            )
        )

    # Rule 2: COMPL_MISSING_PHYSICAL_ADDRESS
    # Look for common address signals (e.g. Street, Suite, Ave, Road, P.O. Box, Postal Code, or "address")
    address_patterns = [
        r"\b\d{1,5}\s+[a-zA-Z0-9\s,\.]+(?:street|st\.|avenue|ave\.|boulevard|blvd\.|road|rd\.|suite|ste\.|floor|fl\.|p\.?o\.?\s*box)\b",
        r"\b(?:postal\s+address|mailing\s+address|registered\s+office)\b",
        r"\b[A-Za-z\s]+,\s*[A-Z]{2}\s+\d{5}(?:-\d{4})?\b",  # US City, ST 12345
    ]

    has_address = any(re.search(pat, combined_text, re.IGNORECASE) for pat in address_patterns)

    if not has_address:
        cfg = RULE_CONFIG["COMPL_MISSING_PHYSICAL_ADDRESS"]
        findings.append(
            DeliverabilityFinding(
                rule_code="COMPL_MISSING_PHYSICAL_ADDRESS",
                category=cfg["category"],
                severity=cfg["severity"],
                title=cfg["title"],
                explanation=cfg["explanation"],
                recommendation=cfg["recommendation"],
                status="failed",
                risk_points=cfg["risk_points"],
            )
        )

    return findings
