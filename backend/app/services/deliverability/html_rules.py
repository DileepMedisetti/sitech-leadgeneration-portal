import ipaddress
import re
from urllib.parse import urlparse
from bs4 import BeautifulSoup

from app.schemas.deliverability import DeliverabilityFinding
from app.services.deliverability.rules_config import RULE_CONFIG

LINK_SHORTENER_DOMAINS = {
    "bit.ly",
    "tinyurl.com",
    "ow.ly",
    "t.co",
    "goo.gl",
    "buff.ly",
    "adf.ly",
    "is.gd",
    "cutt.ly",
}


def evaluate_html_rules(
    html_content: str,
    plain_text: str | None,
) -> list[DeliverabilityFinding]:
    findings: list[DeliverabilityFinding] = []
    soup = BeautifulSoup(html_content, "html.parser")

    # Rule 1: HTML_SCRIPT_OR_IFRAME (Blocker)
    forbidden_tags = soup.find_all(["script", "iframe", "object", "embed", "applet"])
    if forbidden_tags:
        cfg = RULE_CONFIG["HTML_SCRIPT_OR_IFRAME"]
        tag_names = list({t.name for t in forbidden_tags})
        findings.append(
            DeliverabilityFinding(
                rule_code="HTML_SCRIPT_OR_IFRAME",
                category=cfg["category"],
                severity=cfg["severity"],
                title=cfg["title"],
                explanation=f"{cfg['explanation']} Detected tags: <{', <'.join(tag_names)}>.",
                recommendation=cfg["recommendation"],
                status="failed",
                risk_points=cfg["risk_points"],
                evidence={"forbidden_tags": tag_names},
            )
        )

    # Inspect all links
    links = soup.find_all("a", href=True)
    mismatched_links = []
    shortener_links = []
    ip_links = []

    for a in links:
        href = a["href"].strip()
        anchor_text = a.get_text().strip()

        # Check for raw IP links
        parsed = urlparse(href)
        hostname = (parsed.hostname or "").lower()

        if hostname:
            try:
                ip_obj = ipaddress.ip_address(hostname)
                ip_links.append(href)
            except ValueError:
                pass

            # Check link shorteners
            if hostname in LINK_SHORTENER_DOMAINS or any(
                hostname.endswith("." + d) for d in LINK_SHORTENER_DOMAINS
            ):
                shortener_links.append(href)

            # Check destination text mismatch (e.g. anchor text is google.com or mit.edu, but href is attacker.com)
            text_domain_match = re.search(r"\b([a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\.[a-zA-Z]{2,})?)\b", anchor_text)
            if text_domain_match:
                displayed_domain = text_domain_match.group(1).lower()
                # If displayed domain is clearly different from href hostname
                if displayed_domain not in hostname and hostname not in displayed_domain:
                    # Ignore common words or generic protocols
                    if displayed_domain not in {"example.com", "my.link"}:
                        mismatched_links.append({"displayed": displayed_domain, "actual": hostname})

    if ip_links:
        cfg = RULE_CONFIG["HTML_RAW_IP_LINK"]
        findings.append(
            DeliverabilityFinding(
                rule_code="HTML_RAW_IP_LINK",
                category=cfg["category"],
                severity=cfg["severity"],
                title=cfg["title"],
                explanation=f"{cfg['explanation']} Found: {', '.join(ip_links[:3])}.",
                recommendation=cfg["recommendation"],
                status="failed",
                risk_points=cfg["risk_points"],
                evidence={"ip_links": ip_links[:3]},
            )
        )

    if mismatched_links:
        cfg = RULE_CONFIG["HTML_LINK_DESTINATION_MISMATCH"]
        findings.append(
            DeliverabilityFinding(
                rule_code="HTML_LINK_DESTINATION_MISMATCH",
                category=cfg["category"],
                severity=cfg["severity"],
                title=cfg["title"],
                explanation=f"{cfg['explanation']} Example: Text shows '{mismatched_links[0]['displayed']}' but links to '{mismatched_links[0]['actual']}'.",
                recommendation=cfg["recommendation"],
                status="failed",
                risk_points=cfg["risk_points"],
                evidence={"mismatches": mismatched_links[:3]},
            )
        )

    if shortener_links:
        cfg = RULE_CONFIG["HTML_SUSPICIOUS_LINK_SHORTENER"]
        findings.append(
            DeliverabilityFinding(
                rule_code="HTML_SUSPICIOUS_LINK_SHORTENER",
                category=cfg["category"],
                severity=cfg["severity"],
                title=cfg["title"],
                explanation=f"{cfg['explanation']} Found: {', '.join(shortener_links[:3])}.",
                recommendation=cfg["recommendation"],
                status="failed",
                risk_points=cfg["risk_points"],
                evidence={"shortener_links": shortener_links[:3]},
            )
        )

    # Check for hidden text (display:none, font-size:0, font-size:1px, color matches background)
    hidden_elements = []
    for tag in soup.find_all(style=True):
        style = tag["style"].lower().replace(" ", "")
        if "display:none" in style or "visibility:hidden" in style:
            text = tag.get_text().strip()
            if text:
                hidden_elements.append(text[:30])
        elif "font-size:0" in style or "font-size:1px" in style or "font-size:0px" in style:
            text = tag.get_text().strip()
            if text:
                hidden_elements.append(text[:30])

    if hidden_elements:
        cfg = RULE_CONFIG["HTML_HIDDEN_TEXT"]
        findings.append(
            DeliverabilityFinding(
                rule_code="HTML_HIDDEN_TEXT",
                category=cfg["category"],
                severity=cfg["severity"],
                title=cfg["title"],
                explanation=cfg["explanation"],
                recommendation=cfg["recommendation"],
                status="failed",
                risk_points=cfg["risk_points"],
                evidence={"hidden_snippets": hidden_elements[:3]},
            )
        )

    # Check images without alt attribute
    images = soup.find_all("img")
    images_without_alt = [img.get("src", "") for img in images if not img.get("alt") or not img.get("alt").strip()]
    if images and len(images_without_alt) > 0:
        cfg = RULE_CONFIG["HTML_IMAGES_WITHOUT_ALT"]
        findings.append(
            DeliverabilityFinding(
                rule_code="HTML_IMAGES_WITHOUT_ALT",
                category=cfg["category"],
                severity=cfg["severity"],
                title=cfg["title"],
                explanation=f"{cfg['explanation']} ({len(images_without_alt)} of {len(images)} images lack alt text).",
                recommendation=cfg["recommendation"],
                status="failed",
                risk_points=cfg["risk_points"],
                evidence={"images_without_alt_count": len(images_without_alt)},
            )
        )

    # Check missing plain-text alternative
    if not plain_text or len(plain_text.strip()) < 10:
        cfg = RULE_CONFIG["HTML_MISSING_PLAIN_TEXT"]
        findings.append(
            DeliverabilityFinding(
                rule_code="HTML_MISSING_PLAIN_TEXT",
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
