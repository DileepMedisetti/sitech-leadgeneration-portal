import re
from app.schemas.deliverability import DeliverabilityFinding
from app.services.deliverability.rules_config import RULE_CONFIG, SUPPORTED_PERSONALIZATION_TOKENS


def evaluate_token_rules(
    subject: str,
    preview_text: str | None,
    html_content: str,
    plain_text: str | None,
) -> list[DeliverabilityFinding]:
    findings: list[DeliverabilityFinding] = []
    combined_content = f"{subject} {preview_text or ''} {html_content} {plain_text or ''}"

    # Check for broken / malformed placeholders:
    # 1. Opening double braces without closing: {{token
    # 2. Closing double braces without opening: token}}
    # 3. Single braces around known tokens: {name}, {university}
    malformed = []

    # Look for {{ without }}
    open_unclosed = re.findall(r"\{\{[a-zA-Z0-9_\s]+(?!\}\})", combined_content)
    # Filter out properly closed ones
    properly_closed = set(re.findall(r"\{\{[a-zA-Z0-9_\s\|]+\}\}", combined_content))
    for item in open_unclosed:
        if not any(item in prop for prop in properly_closed):
            malformed.append(item.strip())

    # Look for single brace tokens {name}, {first_name}, {email}
    single_braces = re.findall(r"(?<!\{)\{([a-zA-Z0-9_]+)\}(?!\})", combined_content)
    for sb in single_braces:
        if sb.lower() in SUPPORTED_PERSONALIZATION_TOKENS:
            malformed.append(f"{{{sb}}}")

    if malformed:
        cfg = RULE_CONFIG["TOKEN_MALFORMED_SYNTAX"]
        findings.append(
            DeliverabilityFinding(
                rule_code="TOKEN_MALFORMED_SYNTAX",
                category=cfg["category"],
                severity=cfg["severity"],
                title=cfg["title"],
                explanation=f"{cfg['explanation']} Detected: {', '.join(malformed[:5])}.",
                recommendation=cfg["recommendation"],
                status="failed",
                risk_points=cfg["risk_points"],
                evidence={"malformed_tokens": malformed[:5]},
            )
        )

    # Check for valid syntax tokens and see if any are unsupported
    valid_tokens_raw = re.findall(r"\{\{([a-zA-Z0-9_\s\|]+)\}\}", combined_content)
    unsupported = []
    for raw_tok in valid_tokens_raw:
        # If token has fallback like {{first_name|Colleague}}, extract base token
        base_tok = raw_tok.split("|")[0].strip().lower()
        if base_tok not in SUPPORTED_PERSONALIZATION_TOKENS:
            unsupported.append(base_tok)

    if unsupported:
        cfg = RULE_CONFIG["TOKEN_UNSUPPORTED_VARIABLE"]
        findings.append(
            DeliverabilityFinding(
                rule_code="TOKEN_UNSUPPORTED_VARIABLE",
                category=cfg["category"],
                severity=cfg["severity"],
                title=cfg["title"],
                explanation=f"{cfg['explanation']} Unknown: {', '.join(set(unsupported))}.",
                recommendation=cfg["recommendation"],
                status="failed",
                risk_points=cfg["risk_points"],
                evidence={"unsupported_tokens": list(set(unsupported))},
            )
        )

    return findings
