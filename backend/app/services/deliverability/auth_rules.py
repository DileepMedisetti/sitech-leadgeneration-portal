import re
from app.schemas.deliverability import DeliverabilityFinding
from app.services.deliverability.rules_config import RULE_CONFIG
from app.services.extraction.cleaners import is_valid_email

FREE_MAILBOX_DOMAINS = {
    "gmail.com",
    "yahoo.com",
    "hotmail.com",
    "outlook.com",
    "aol.com",
    "icloud.com",
    "mail.com",
    "protonmail.com",
    "zoho.com",
}


def evaluate_auth_rules(
    from_email: str,
    reply_to: str | None,
) -> list[DeliverabilityFinding]:
    findings: list[DeliverabilityFinding] = []

    clean_from = from_email.strip().lower()

    # Rule 1: AUTH_INVALID_FROM_FORMAT (Blocker)
    if not is_valid_email(clean_from):
        cfg = RULE_CONFIG["AUTH_INVALID_FROM_FORMAT"]
        findings.append(
            DeliverabilityFinding(
                rule_code="AUTH_INVALID_FROM_FORMAT",
                category=cfg["category"],
                severity=cfg["severity"],
                title=cfg["title"],
                explanation=f"{cfg['explanation']} Received: '{from_email}'.",
                recommendation=cfg["recommendation"],
                status="failed",
                risk_points=cfg["risk_points"],
            )
        )
        return findings

    from_domain = clean_from.split("@")[-1]

    # Rule 2: AUTH_FREE_MAILBOX_SENDER
    if from_domain in FREE_MAILBOX_DOMAINS:
        cfg = RULE_CONFIG["AUTH_FREE_MAILBOX_SENDER"]
        findings.append(
            DeliverabilityFinding(
                rule_code="AUTH_FREE_MAILBOX_SENDER",
                category=cfg["category"],
                severity=cfg["severity"],
                title=cfg["title"],
                explanation=f"{cfg['explanation']} Sender is @{from_domain}.",
                recommendation=cfg["recommendation"],
                status="failed",
                risk_points=cfg["risk_points"],
                evidence={"from_domain": from_domain},
            )
        )

    # Rule 3: AUTH_DOMAIN_ALIGNMENT_MISMATCH
    if reply_to and reply_to.strip():
        clean_reply = reply_to.strip().lower()
        if is_valid_email(clean_reply):
            reply_domain = clean_reply.split("@")[-1]
            if reply_domain != from_domain:
                cfg = RULE_CONFIG["AUTH_DOMAIN_ALIGNMENT_MISMATCH"]
                findings.append(
                    DeliverabilityFinding(
                        rule_code="AUTH_DOMAIN_ALIGNMENT_MISMATCH",
                        category=cfg["category"],
                        severity=cfg["severity"],
                        title=cfg["title"],
                        explanation=f"{cfg['explanation']} (From: @{from_domain}, Reply-To: @{reply_domain}).",
                        recommendation=cfg["recommendation"],
                        status="failed",
                        risk_points=cfg["risk_points"],
                        evidence={"from_domain": from_domain, "reply_to_domain": reply_domain},
                    )
                )

    # Rule 4: AUTH_TECHNICAL_RECORD_ABSENCE
    # We check DNS records for SPF and DMARC without blocking or making slow calls.
    # Distinguish verified failure vs unknown/not_checked
    try:
        import dns.resolver
        resolver = dns.resolver.Resolver()
        resolver.timeout = 2.0
        resolver.lifetime = 2.0

        has_spf = False
        try:
            txt_records = resolver.resolve(from_domain, "TXT")
            for record in txt_records:
                txt_str = record.to_text().strip('"')
                if "v=spf1" in txt_str:
                    has_spf = True
                    break
        except Exception:
            has_spf = False

        has_dmarc = False
        try:
            dmarc_records = resolver.resolve(f"_dmarc.{from_domain}", "TXT")
            for record in dmarc_records:
                txt_str = record.to_text().strip('"')
                if "v=DMARC1" in txt_str:
                    has_dmarc = True
                    break
        except Exception:
            has_dmarc = False

        if not has_spf or not has_dmarc:
            cfg = RULE_CONFIG["AUTH_TECHNICAL_RECORD_ABSENCE"]
            missing_records = []
            if not has_spf:
                missing_records.append("SPF (v=spf1)")
            if not has_dmarc:
                missing_records.append("DMARC (v=DMARC1)")

            findings.append(
                DeliverabilityFinding(
                    rule_code="AUTH_TECHNICAL_RECORD_ABSENCE",
                    category=cfg["category"],
                    severity=cfg["severity"],
                    title=cfg["title"],
                    explanation=f"{cfg['explanation']} Missing in DNS for @{from_domain}: {', '.join(missing_records)}.",
                    recommendation=cfg["recommendation"],
                    status="failed",
                    risk_points=cfg["risk_points"],
                    evidence={"missing_records": missing_records, "domain": from_domain},
                )
            )
    except ImportError:
        cfg = RULE_CONFIG["AUTH_TECHNICAL_RECORD_ABSENCE"]
        findings.append(
            DeliverabilityFinding(
                rule_code="AUTH_TECHNICAL_RECORD_ABSENCE",
                category=cfg["category"],
                severity=cfg["severity"],
                title=cfg["title"],
                explanation=f"{cfg['explanation']} (DNS verification library unavailable in local runtime; verification omitted).",
                recommendation=cfg["recommendation"],
                status="unknown",
                risk_points=0.0,
                evidence={"status": "unavailable", "domain": from_domain},
            )
        )
    except Exception as exc:
        cfg = RULE_CONFIG["AUTH_TECHNICAL_RECORD_ABSENCE"]
        findings.append(
            DeliverabilityFinding(
                rule_code="AUTH_TECHNICAL_RECORD_ABSENCE",
                category=cfg["category"],
                severity=cfg["severity"],
                title=cfg["title"],
                explanation=f"{cfg['explanation']} (DNS query returned unavailable/timeout: {str(exc)}).",
                recommendation=cfg["recommendation"],
                status="unknown",
                risk_points=0.0,
                evidence={"status": "unavailable", "domain": from_domain},
            )
        )

    return findings
