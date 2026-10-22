import ipaddress
import re
from typing import Any
from urllib.parse import urlparse
from bs4 import BeautifulSoup

from app.services.deliverability.analyzer_service import analyze_email_content
from app.services.deliverability.auth_rules import FREE_MAILBOX_DOMAINS
from app.services.deliverability.html_rules import LINK_SHORTENER_DOMAINS


FEATURE_NAMES = [
    "subject_char_length",
    "subject_word_count",
    "subject_caps_ratio",
    "subject_has_exclamation",
    "subject_has_re_fwd",
    "body_char_length",
    "body_word_count",
    "body_text_html_ratio",
    "link_count",
    "link_shortener_count",
    "has_raw_ip_link",
    "has_link_mismatch",
    "has_script_or_iframe",
    "has_hidden_text",
    "image_count",
    "images_missing_alt_count",
    "has_plain_text_alt",
    "has_unsubscribe",
    "has_physical_address",
    "is_free_mailbox_sender",
    "domain_alignment_mismatch",
    "token_count",
    "rule_risk_score",
    "has_rule_blockers",
]


def extract_content_features(
    subject: str,
    preview_text: str | None,
    from_name: str,
    from_email: str,
    reply_to: str | None,
    html_content: str,
    plain_text: str | None,
    rule_risk_score: float | None = None,
    has_rule_blockers: bool | None = None,
) -> dict[str, float]:
    """Extract a versioned, reproducible numerical feature vector from email content."""
    clean_subj = (subject or "").strip()
    words = re.findall(r"\b[A-Za-z0-9'-]+\b", clean_subj)
    caps_words = [w for w in words if w.isupper() and len(w) > 2]
    caps_ratio = len(caps_words) / len(words) if words else 0.0

    has_exclamation = 1.0 if "!" in clean_subj else 0.0
    has_re_fwd = 1.0 if re.match(r"^\s*(?:re|fwd|fw)\s*:", clean_subj, re.IGNORECASE) else 0.0

    soup = BeautifulSoup(html_content or "", "html.parser")
    body_text = soup.get_text(separator=" ").strip()
    body_words = re.findall(r"\b[A-Za-z0-9'-]+\b", body_text)
    text_chars = len(re.sub(r"\s+", "", body_text))
    html_chars = len(html_content or "")
    text_html_ratio = text_chars / html_chars if html_chars > 0 else 0.0

    # Links
    links = soup.find_all("a", href=True)
    link_count = float(len(links))
    shortener_count = 0.0
    has_raw_ip = 0.0
    has_mismatch = 0.0

    for a in links:
        href = a["href"].strip()
        parsed = urlparse(href)
        host = (parsed.hostname or "").lower()
        if host:
            try:
                ipaddress.ip_address(host)
                has_raw_ip = 1.0
            except ValueError:
                pass

            if host in LINK_SHORTENER_DOMAINS or any(host.endswith("." + d) for d in LINK_SHORTENER_DOMAINS):
                shortener_count += 1.0

            anchor_text = a.get_text().strip()
            match = re.search(r"\b([a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\.[a-zA-Z]{2,})?)\b", anchor_text)
            if match:
                disp = match.group(1).lower()
                if disp not in host and host not in disp:
                    has_mismatch = 1.0

    # Scripts / iframes
    has_script_or_iframe = 1.0 if soup.find_all(["script", "iframe", "object", "embed"]) else 0.0

    # Hidden text
    has_hidden = 0.0
    for tag in soup.find_all(style=True):
        style = tag["style"].lower().replace(" ", "")
        if "display:none" in style or "visibility:hidden" in style or "font-size:0" in style:
            if tag.get_text().strip():
                has_hidden = 1.0
                break

    # Images
    images = soup.find_all("img")
    image_count = float(len(images))
    missing_alt = sum(1.0 for img in images if not img.get("alt") or not img.get("alt").strip())

    # Plain text
    has_plain = 1.0 if plain_text and len(plain_text.strip()) > 10 else 0.0

    # Unsubscribe
    combined_body = f"{html_content or ''} {plain_text or ''}".lower()
    has_unsub = 0.0
    if "unsubscribe" in combined_body or "{{unsubscribe_url}}" in combined_body:
        has_unsub = 1.0

    # Physical address
    address_patterns = [
        r"\b\d{1,5}\s+[a-zA-Z0-9\s,\.]+(?:street|st\.|avenue|ave\.|boulevard|blvd\.|road|rd\.|suite|ste\.|floor|fl\.|p\.?o\.?\s*box)\b",
        r"\b(?:postal\s+address|mailing\s+address|registered\s+office)\b",
    ]
    has_address = 1.0 if any(re.search(pat, combined_body, re.IGNORECASE) for pat in address_patterns) else 0.0

    # Sender & alignment
    clean_from = (from_email or "").strip().lower()
    from_domain = clean_from.split("@")[-1] if "@" in clean_from else ""
    is_free = 1.0 if from_domain in FREE_MAILBOX_DOMAINS else 0.0

    domain_mismatch = 0.0
    if reply_to and reply_to.strip():
        reply_domain = reply_to.strip().lower().split("@")[-1] if "@" in reply_to else ""
        if reply_domain and reply_domain != from_domain:
            domain_mismatch = 1.0

    # Personalization tokens
    tokens = re.findall(r"\{\{[a-zA-Z0-9_\s\|]+\}\}", f"{subject} {html_content or ''}")
    token_count = float(len(tokens))

    # Rule scores
    if rule_risk_score is None or has_rule_blockers is None:
        computed_score, _, _, _, computed_blockers = analyze_email_content(
            subject=subject,
            preview_text=preview_text,
            from_name=from_name,
            from_email=from_email,
            reply_to=reply_to,
            html_content=html_content,
            plain_text=plain_text,
        )
        final_score = computed_score
        final_blockers = 1.0 if computed_blockers else 0.0
    else:
        final_score = float(rule_risk_score)
        final_blockers = 1.0 if has_rule_blockers else 0.0

    features = {
        "subject_char_length": float(len(clean_subj)),
        "subject_word_count": float(len(words)),
        "subject_caps_ratio": round(caps_ratio, 4),
        "subject_has_exclamation": has_exclamation,
        "subject_has_re_fwd": has_re_fwd,
        "body_char_length": float(html_chars),
        "body_word_count": float(len(body_words)),
        "body_text_html_ratio": round(text_html_ratio, 4),
        "link_count": link_count,
        "link_shortener_count": shortener_count,
        "has_raw_ip_link": has_raw_ip,
        "has_link_mismatch": has_mismatch,
        "has_script_or_iframe": has_script_or_iframe,
        "has_hidden_text": has_hidden,
        "image_count": image_count,
        "images_missing_alt_count": missing_alt,
        "has_plain_text_alt": has_plain,
        "has_unsubscribe": has_unsub,
        "has_physical_address": has_address,
        "is_free_mailbox_sender": is_free,
        "domain_alignment_mismatch": domain_mismatch,
        "token_count": token_count,
        "rule_risk_score": final_score,
        "has_rule_blockers": final_blockers,
    }

    return features
