import os
import random
from typing import Any
import numpy as np
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.campaign import Campaign, CampaignContent
from app.models.deliverability import PlacementTestJob, PlacementTestSeedResult
from app.services.ml.feature_extractor import FEATURE_NAMES, extract_content_features

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data")


def ensure_data_dir() -> str:
    os.makedirs(DATA_DIR, exist_ok=True)
    return DATA_DIR


# Curated benchmark sample templates representing verified inbox academic outreach vs spam violations
BENCHMARK_OBSERVATIONS = [
    # Clean academic collaboration (Expected: Inbox)
    {
        "subject": "Research Collaboration on Biomedical Signal Processing",
        "preview_text": "Exploring joint lab initiatives across faculty members.",
        "from_name": "Prof. David Miller",
        "from_email": "d.miller@cambridge-consortium.edu",
        "reply_to": "d.miller@cambridge-consortium.edu",
        "html_content": (
            "<p>Dear {{name}},</p>"
            "<p>We have reviewed your recent publications in computational biology and would welcome a discussion on potential cross-institutional collaboration.</p>"
            "<p>Please review our working paper at <a href='https://cambridge-consortium.edu/papers/2026'>our working paper repository</a>.</p>"
            "<p>Best regards,<br/>David Miller</p>"
            "<hr/><p>Cambridge Consortium, 50 Memorial Drive, Cambridge, MA 02139</p>"
            "<p><a href='{{unsubscribe_url}}'>Unsubscribe from these announcements</a></p>"
        ),
        "plain_text": "Dear {{name}},\nWe would welcome a discussion on research collaboration.\n50 Memorial Drive, Cambridge, MA\nUnsubscribe: {{unsubscribe_url}}",
        "outcome": "inbox",
    },
    {
        "subject": "Symposium on Materials Engineering — Keynote Invitation",
        "preview_text": "Inviting selected department chairs to keynote our 2026 symposium.",
        "from_name": "Conference Secretariat",
        "from_email": "symposium@materials-institute.org",
        "reply_to": "symposium@materials-institute.org",
        "html_content": (
            "<p>Dear {{name}},</p>"
            "<p>On behalf of the academic organizing committee, we are delighted to invite you to present a keynote lecture.</p>"
            "<p>Full event itinerary is available at <a href='https://materials-institute.org/symposium2026'>Symposium Details</a>.</p>"
            "<p><img src='https://materials-institute.org/badge.png' alt='Institute Badge'/></p>"
            "<hr/><p>Materials Institute, 12 Kensington Square, London W8 5HH, UK</p>"
            "<p><a href='https://materials-institute.org/optout'>Opt-out</a></p>"
        ),
        "plain_text": "Dear {{name}},\nWe invite you to present a keynote lecture.\nMaterials Institute, 12 Kensington Square, London.\nOpt-out: https://materials-institute.org/optout",
        "outcome": "inbox",
    },
    {
        "subject": "Grant Application Co-Investigator Opportunity",
        "preview_text": "Federal science foundation proposal in advanced robotics.",
        "from_name": "Dr. Sarah Lin",
        "from_email": "s.lin@robotics-research.org",
        "reply_to": "s.lin@robotics-research.org",
        "html_content": (
            "<p>Dear {{name}},</p>"
            "<p>Our consortium is drafting a multi-site robotics grant proposal. Your work in control theory would provide essential expertise.</p>"
            "<p>Review the grant outline: <a href='https://robotics-research.org/grants'>Robotics Proposal</a>.</p>"
            "<hr/><p>Robotics Research Foundation, 800 Technology Square, Atlanta, GA 30332</p>"
            "<p><a href='{{unsubscribe_url}}'>Unsubscribe</a></p>"
        ),
        "plain_text": "Dear {{name}},\nProposal review available at https://robotics-research.org/grants\nUnsubscribe: {{unsubscribe_url}}",
        "outcome": "inbox",
    },
    # High-risk promotional spam (Expected: Spam)
    {
        "subject": "URGENT WIRE TRANSFER: 100% FREE GUARANTEED CASH PAYOUT",
        "preview_text": "Act now to claim your payout immediately.",
        "from_name": "Fast Funds",
        "from_email": "fastcash99@gmail.com",
        "reply_to": "collect@stealth-wire.xyz",
        "html_content": (
            "<html><body>"
            "<script>alert('pwn')</script>"
            "<h1>CONGRATULATIONS! YOU HAVE WON!</h1>"
            "<p>ACT NOW! 100% free guaranteed wire transfer cash payout!</p>"
            "<a href='http://192.168.1.1/claim'>Click http://harvard.edu to claim</a>"
            "<a href='http://bit.ly/fake3492'>Claim fast cash</a>"
            "<div style='display:none;'>hidden spam keywords buy now cheap pills wire transfer</div>"
            "</body></html>"
        ),
        "plain_text": "",
        "outcome": "spam",
    },
    {
        "subject": "ACCOUNT SUSPENDED: VERIFY YOUR CREDENTIALS IMMEDIATELY",
        "preview_text": "Your mailbox will be disabled in 24 hours.",
        "from_name": "IT Helpdesk",
        "from_email": "helpdesk-security@yahoo.com",
        "reply_to": "phish@credential-harvest.ru",
        "html_content": (
            "<div>"
            "<p>Dear {{unsupported_placeholder}},</p>"
            "<p>Your academic account has experienced unauthorized logins.</p>"
            "<p><a href='http://10.0.0.1/auth'>Verify login at harvard.edu</a></p>"
            "<a href='http://tinyurl.com/pass982'>Reset Password</a>"
            "</div>"
        ),
        "plain_text": "",
        "outcome": "spam",
    },
    {
        "subject": "Re: Risk-free trial payout for academic departments",
        "preview_text": "Immediate wire transfer funds available.",
        "from_name": "Commercial Grants",
        "from_email": "grants@hotmail.com",
        "reply_to": "info@unregistered-shell.biz",
        "html_content": (
            "<p>Make $5,000 daily from home! 100% free guaranteed!</p>"
            "<p><a href='http://cutt.ly/money48'>Register</a></p>"
            "<p style='font-size:0px;'>cheap loans wire transfer cryptocurrency</p>"
        ),
        "plain_text": None,
        "outcome": "spam",
    },
]


def load_dataset_records(db: Session | None = None) -> list[dict[str, Any]]:
    """Loads feature vectors and binary placement labels (1 for inbox, 0 for spam/filtered)."""
    records: list[dict[str, Any]] = []

    # 1. Load real seedbox results from database if available
    if db is not None:
        stmt = (
            select(PlacementTestSeedResult, PlacementTestJob, CampaignContent)
            .join(PlacementTestJob, PlacementTestSeedResult.test_job_id == PlacementTestJob.id)
            .join(Campaign, PlacementTestJob.campaign_id == Campaign.id)
            .join(
                CampaignContent,
                (CampaignContent.campaign_id == Campaign.id)
                & (CampaignContent.version == PlacementTestJob.content_version),
            )
            .where(PlacementTestSeedResult.outcome.in_(["inbox", "spam", "other"]))
        )
        db_rows = db.execute(stmt).all()
        for seed_res, job, content in db_rows:
            label = 1 if seed_res.outcome == "inbox" else 0
            features = extract_content_features(
                subject=content.subject,
                preview_text=content.preview_text,
                from_name=content.from_name,
                from_email=content.from_email,
                reply_to=content.reply_to,
                html_content=content.html_content,
                plain_text=content.plain_text,
            )
            records.append({
                "features": features,
                "label": label,
                "source": "db_placement_test",
                "campaign_id": job.campaign_id,
                "provider": seed_res.mailbox_provider,
            })

    # 2. Enrich with calibrated benchmark patterns (with slight realistic variations to build robust distributions)
    random.seed(42)
    for sample in BENCHMARK_OBSERVATIONS:
        base_features = extract_content_features(
            subject=sample["subject"],
            preview_text=sample["preview_text"],
            from_name=sample["from_name"],
            from_email=sample["from_email"],
            reply_to=sample["reply_to"],
            html_content=sample["html_content"],
            plain_text=sample["plain_text"],
        )
        base_label = 1 if sample["outcome"] == "inbox" else 0

        # Generate controlled variations
        for var_idx in range(12):
            feat_copy = dict(base_features)
            # Add small jitter to continuous features without changing semantics
            feat_copy["subject_char_length"] += random.randint(-5, 5)
            feat_copy["body_char_length"] = max(50.0, feat_copy["body_char_length"] + random.randint(-20, 20))
            feat_copy["body_word_count"] = max(10.0, feat_copy["body_word_count"] + random.randint(-5, 5))

            records.append({
                "features": feat_copy,
                "label": base_label,
                "source": "calibrated_benchmark",
                "campaign_id": 1000 + var_idx,
                "provider": "aggregate",
            })

    return records


def prepare_training_matrices(
    records: list[dict[str, Any]],
) -> tuple[np.ndarray, np.ndarray, list[str]]:
    """Converts records into NumPy feature matrix X and label vector y."""
    X_rows = []
    y_vals = []

    for r in records:
        feat = r["features"]
        row = [float(feat.get(k, 0.0)) for k in FEATURE_NAMES]
        X_rows.append(row)
        y_vals.append(int(r["label"]))

    X = np.array(X_rows, dtype=np.float64)
    y = np.array(y_vals, dtype=np.int64)
    return X, y, FEATURE_NAMES
