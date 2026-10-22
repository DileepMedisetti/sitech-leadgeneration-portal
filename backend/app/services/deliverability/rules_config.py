"""Centralized configuration and weights for the Rule-Based Deliverability Engine.

All penalties, severity levels, and category ceilings are declared here
to ensure maintainability and eliminate magic numbers.
"""

RULE_CONFIG = {
    # --------------------------------------------------------------------------
    # Content & Subject Rules
    # --------------------------------------------------------------------------
    "SUBJ_ALL_CAPS": {
        "category": "content",
        "severity": "warning",
        "risk_points": 15.0,
        "title": "Excessive Capitalization in Subject",
        "explanation": "Subject lines with excessive uppercase words trigger anti-spam heuristic filters.",
        "recommendation": "Use sentence-case or title-case capitalization.",
    },
    "SUBJ_EXCESSIVE_PUNCTUATION": {
        "category": "content",
        "severity": "warning",
        "risk_points": 10.0,
        "title": "Excessive Punctuation in Subject",
        "explanation": "Repeated exclamation points (!!!) or question marks (???) resemble aggressive unsolicited marketing.",
        "recommendation": "Limit punctuation to standard punctuation marks without consecutive repeats.",
    },
    "SUBJ_DECEPTIVE_PREFIX": {
        "category": "content",
        "severity": "error",
        "risk_points": 25.0,
        "title": "Deceptive Thread Prefix in Subject",
        "explanation": "Using 'Re:' or 'Fwd:' when there is no prior conversational thread violates commercial email honesty standards.",
        "recommendation": "Remove artificial 'Re:' or 'Fwd:' prefixes from initial cold outreach.",
    },
    "BODY_SPAM_TRIGGER_WORDS": {
        "category": "content",
        "severity": "warning",
        "risk_points": 15.0,
        "title": "High-Frequency Spam Risk Phrases",
        "explanation": "Body contains high-risk promotional triggers like '100% free guaranteed', 'risk-free cash payout', or wire-transfer terms.",
        "recommendation": "Replace aggressive marketing jargon with direct, value-focused academic or professional phrasing.",
    },
    "BODY_LOW_TEXT_HTML_RATIO": {
        "category": "content",
        "severity": "warning",
        "risk_points": 15.0,
        "title": "Low Text-to-HTML Ratio",
        "explanation": "Heavy HTML markup with very little textual content is a common fingerprint of image-only spam flyers.",
        "recommendation": "Ensure substantive textual paragraphs (at least 50 words) accompany HTML structure.",
    },

    # --------------------------------------------------------------------------
    # Personalization Token Rules
    # --------------------------------------------------------------------------
    "TOKEN_MALFORMED_SYNTAX": {
        "category": "personalization",
        "severity": "error",
        "risk_points": 20.0,
        "title": "Malformed Personalization Placeholder",
        "explanation": "Found broken placeholders (e.g. '{{name', '{name}}') which will render as broken syntax to recipients.",
        "recommendation": "Ensure all tokens follow valid double-curly syntax: {{token_name}}.",
    },
    "TOKEN_UNSUPPORTED_VARIABLE": {
        "category": "personalization",
        "severity": "warning",
        "risk_points": 10.0,
        "title": "Unsupported Personalization Variable",
        "explanation": "Found placeholders not defined in the contact schema.",
        "recommendation": "Use supported variables: {{name}}, {{first_name}}, {{university}}, {{department}}, {{profession}}, {{country}}, {{email}}.",
    },

    # --------------------------------------------------------------------------
    # HTML & Links Rules
    # --------------------------------------------------------------------------
    "HTML_SCRIPT_OR_IFRAME": {
        "category": "html_links",
        "severity": "blocker",
        "risk_points": 40.0,
        "title": "Executable Scripts or IFrames Detected",
        "explanation": "<script>, <object>, or <iframe> tags pose extreme security risks and are universally quarantined by email receivers.",
        "recommendation": "Remove all executable scripts, objects, and iframe tags immediately.",
    },
    "HTML_LINK_DESTINATION_MISMATCH": {
        "category": "html_links",
        "severity": "blocker",
        "risk_points": 35.0,
        "title": "Phishing Signal: Anchor Text Conflicts with Destination",
        "explanation": "Link text displays a domain name (e.g. mit.edu) that points to a completely different destination host.",
        "recommendation": "Ensure visible domain names match the actual URL href target.",
    },
    "HTML_SUSPICIOUS_LINK_SHORTENER": {
        "category": "html_links",
        "severity": "warning",
        "risk_points": 15.0,
        "title": "Public Link Shortener Detected",
        "explanation": "Link shorteners (e.g., bit.ly, tinyurl, t.co) mask real destinations and are heavily penalized by mailbox reputation systems.",
        "recommendation": "Use direct, branded institutional URLs instead of public link shortening services.",
    },
    "HTML_RAW_IP_LINK": {
        "category": "html_links",
        "severity": "blocker",
        "risk_points": 35.0,
        "title": "Link Points to Raw IP Address",
        "explanation": "Direct IP-address links (e.g., http://192.0.2.1) are characteristic of phishing campaigns.",
        "recommendation": "Replace IP-based links with verified fully qualified domain names.",
    },
    "HTML_HIDDEN_TEXT": {
        "category": "html_links",
        "severity": "error",
        "risk_points": 25.0,
        "title": "Hidden or Deceptive Content Detected",
        "explanation": "Elements with zero font-size, display:none, or foreground colors identical to background colors mimic spam keyword stuffing.",
        "recommendation": "Remove hidden text styling and keep all email copy visible.",
    },
    "HTML_IMAGES_WITHOUT_ALT": {
        "category": "html_links",
        "severity": "info",
        "risk_points": 5.0,
        "title": "Images Missing Descriptive Alt Text",
        "explanation": "Images without alt attributes hurt accessibility and trigger spam caution when images are disabled by default.",
        "recommendation": "Add concise, informative alt attributes to all <img> elements.",
    },
    "HTML_MISSING_PLAIN_TEXT": {
        "category": "html_links",
        "severity": "warning",
        "risk_points": 10.0,
        "title": "Missing Plain-Text Multipart Alternative",
        "explanation": "HTML-only emails lack a multipart fallback for text-only clients and smart watches.",
        "recommendation": "Provide a clean plain-text version alongside the HTML body.",
    },

    # --------------------------------------------------------------------------
    # Authentication & Alignment Rules
    # --------------------------------------------------------------------------
    "AUTH_INVALID_FROM_FORMAT": {
        "category": "authentication",
        "severity": "blocker",
        "risk_points": 40.0,
        "title": "Invalid Sender Address Format",
        "explanation": "Sender email is malformed or not a valid RFC-compliant mailbox address.",
        "recommendation": "Configure a valid from_email address (e.g. outreach@sitechseries.com).",
    },
    "AUTH_FREE_MAILBOX_SENDER": {
        "category": "authentication",
        "severity": "error",
        "risk_points": 25.0,
        "title": "Commercial Outreach from Free Mailbox Provider",
        "explanation": "Sending bulk outreach from @gmail.com, @yahoo.com, or @hotmail.com violates DMARC p=reject policies.",
        "recommendation": "Use your organization's custom verified domain for sending.",
    },
    "AUTH_DOMAIN_ALIGNMENT_MISMATCH": {
        "category": "authentication",
        "severity": "warning",
        "risk_points": 10.0,
        "title": "From and Reply-To Domain Alignment Mismatch",
        "explanation": "The From domain and Reply-To domain differ, which may require explicit SPF/DKIM verification for both domains.",
        "recommendation": "Align Reply-To with the From domain or ensure both domains have verified DKIM records.",
    },
    "AUTH_TECHNICAL_RECORD_ABSENCE": {
        "category": "authentication",
        "severity": "warning",
        "risk_points": 15.0,
        "title": "SPF/DMARC Record Presence Not Confirmed",
        "explanation": "Sender domain lacks documented SPF or DMARC DNS TXT records, increasing spoofing risk.",
        "recommendation": "Publish valid v=spf1 and v=DMARC1 TXT records in your sender domain DNS zone.",
    },

    # --------------------------------------------------------------------------
    # Unsubscribe & Compliance Rules
    # --------------------------------------------------------------------------
    "COMPL_MISSING_UNSUBSCRIBE": {
        "category": "compliance",
        "severity": "blocker",
        "risk_points": 35.0,
        "title": "Missing Mandatory Unsubscribe Mechanism",
        "explanation": "No opt-out or unsubscribe mechanism was detected in the email body or template. This violates CAN-SPAM and GDPR requirements.",
        "recommendation": "Include an explicit unsubscribe link (e.g. {{unsubscribe_url}} or an Unsubscribe anchor link).",
    },
    "COMPL_MISSING_PHYSICAL_ADDRESS": {
        "category": "compliance",
        "severity": "warning",
        "risk_points": 10.0,
        "title": "Missing Physical Postal Address or Entity Identification",
        "explanation": "Commercial email regulations mandate clear identification of the sender's physical postal address.",
        "recommendation": "Include your organization's valid physical mailing address in the email footer.",
    },
}

SUPPORTED_PERSONALIZATION_TOKENS = {
    "name",
    "first_name",
    "last_name",
    "email",
    "university",
    "department",
    "profession",
    "country",
    "source_url",
    "unsubscribe_url",
}
