import re
from app.schemas.deliverability import DeliverabilityFinding
from app.services.deliverability.rules_config import RULE_CONFIG


SPAM_TRIGGER_PATTERNS = [
    r"\b100%\s*(?:free|guaranteed)\b",
    r"\brisk[- ]free\s*(?:trial|cash|offer|payout)\b",
    r"\bcongratulations!?\s+you(?:'ve|\s+have)?\s+won\b",
    r"\bact\s+now!?\s+limited\s+time\b",
    r"\bwire\s+transfer\s+(?:funds|money|immediately)\b",
    r"\baccount\s+(?:suspended|restricted)\s+verify\s+now\b",
    r"\bmake\s+\$?\d+[\d,]*\s+(?:fast|today|daily|from home)\b",
]


def evaluate_content_rules(
    subject: str,
    preview_text: str | None,
    html_content: str,
    plain_text: str | None,
) -> list[DeliverabilityFinding]:
    findings: list[DeliverabilityFinding] = []

    clean_subj = subject.strip()

    # Rule 1: SUBJ_ALL_CAPS
    words = [w for w in re.findall(r"\b[A-Za-z]{2,}\b", clean_subj)]
    if words:
        caps_words = [w for w in words if w.isupper() and len(w) > 2]
        ratio = len(caps_words) / len(words)
        if ratio > 0.4 or (clean_subj.isupper() and len(words) >= 3):
            cfg = RULE_CONFIG["SUBJ_ALL_CAPS"]
            findings.append(
                DeliverabilityFinding(
                    rule_code="SUBJ_ALL_CAPS",
                    category=cfg["category"],
                    severity=cfg["severity"],
                    title=cfg["title"],
                    explanation=f"{cfg['explanation']} ({len(caps_words)} of {len(words)} words in uppercase).",
                    recommendation=cfg["recommendation"],
                    status="failed",
                    risk_points=cfg["risk_points"],
                    evidence={"caps_words": caps_words[:5]},
                )
            )

    # Rule 2: SUBJ_EXCESSIVE_PUNCTUATION
    if re.search(r"[!?]{2,}", clean_subj) or clean_subj.count("!") > 2 or clean_subj.count("?") > 2:
        cfg = RULE_CONFIG["SUBJ_EXCESSIVE_PUNCTUATION"]
        findings.append(
            DeliverabilityFinding(
                rule_code="SUBJ_EXCESSIVE_PUNCTUATION",
                category=cfg["category"],
                severity=cfg["severity"],
                title=cfg["title"],
                explanation=cfg["explanation"],
                recommendation=cfg["recommendation"],
                status="failed",
                risk_points=cfg["risk_points"],
                evidence={"punctuation_pattern": re.findall(r"[!?]+", clean_subj)},
            )
        )

    # Rule 3: SUBJ_DECEPTIVE_PREFIX
    if re.match(r"^\s*(?:re|fwd|fw)\s*:", clean_subj, re.IGNORECASE):
        cfg = RULE_CONFIG["SUBJ_DECEPTIVE_PREFIX"]
        findings.append(
            DeliverabilityFinding(
                rule_code="SUBJ_DECEPTIVE_PREFIX",
                category=cfg["category"],
                severity=cfg["severity"],
                title=cfg["title"],
                explanation=cfg["explanation"],
                recommendation=cfg["recommendation"],
                status="failed",
                risk_points=cfg["risk_points"],
            )
        )

    # Rule 4: BODY_SPAM_TRIGGER_WORDS
    full_body = f"{html_content} {plain_text or ''}".lower()
    matched_triggers = []
    for pattern in SPAM_TRIGGER_PATTERNS:
        match = re.search(pattern, full_body, re.IGNORECASE)
        if match:
            matched_triggers.append(match.group(0))

    if matched_triggers:
        cfg = RULE_CONFIG["BODY_SPAM_TRIGGER_WORDS"]
        findings.append(
            DeliverabilityFinding(
                rule_code="BODY_SPAM_TRIGGER_WORDS",
                category=cfg["category"],
                severity=cfg["severity"],
                title=cfg["title"],
                explanation=f"{cfg['explanation']} Found: {', '.join(matched_triggers[:3])}.",
                recommendation=cfg["recommendation"],
                status="failed",
                risk_points=cfg["risk_points"],
                evidence={"matched_triggers": matched_triggers},
            )
        )

    # Rule 5: BODY_LOW_TEXT_HTML_RATIO
    from bs4 import BeautifulSoup
    soup = BeautifulSoup(html_content, "html.parser")
    text_content = soup.get_text(separator=" ").strip()
    text_length = len(re.sub(r"\s+", "", text_content))
    html_length = len(html_content)

    if html_length > 1000 and (text_length / html_length < 0.10 or len(text_content.split()) < 20):
        cfg = RULE_CONFIG["BODY_LOW_TEXT_HTML_RATIO"]
        findings.append(
            DeliverabilityFinding(
                rule_code="BODY_LOW_TEXT_HTML_RATIO",
                category=cfg["category"],
                severity=cfg["severity"],
                title=cfg["title"],
                explanation=f"{cfg['explanation']} (text characters: {text_length}, HTML characters: {html_length}).",
                recommendation=cfg["recommendation"],
                status="failed",
                risk_points=cfg["risk_points"],
                evidence={"text_length": text_length, "html_length": html_length},
            )
        )

    return findings
