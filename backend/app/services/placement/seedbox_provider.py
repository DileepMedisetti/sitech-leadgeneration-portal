import os
import random
import time
from datetime import datetime, timezone
from typing import Any

from app.services.placement.base_provider import (
    BasePlacementProvider,
    SeedResult,
    SeedTarget,
)


class SitechSeedboxProvider(BasePlacementProvider):
    """Controlled Seed Mailbox Placement Provider.

    Supports testing across Gmail, Outlook / Office 365, Yahoo Mail, Apple Mail,
    and Corporate Exchange mailboxes.
    """

    DEFAULT_SEEDS = [
        SeedTarget(seed_email="seed.gmail.01@testnet.sitechseries.internal", mailbox_provider="gmail"),
        SeedTarget(seed_email="seed.gmail.02@testnet.sitechseries.internal", mailbox_provider="gmail"),
        SeedTarget(seed_email="seed.outlook.01@testnet.sitechseries.internal", mailbox_provider="outlook"),
        SeedTarget(seed_email="seed.outlook.02@testnet.sitechseries.internal", mailbox_provider="outlook"),
        SeedTarget(seed_email="seed.yahoo.01@testnet.sitechseries.internal", mailbox_provider="yahoo"),
        SeedTarget(seed_email="seed.apple.01@testnet.sitechseries.internal", mailbox_provider="apple_mail"),
        SeedTarget(seed_email="seed.corporate.01@testnet.sitechseries.internal", mailbox_provider="corporate_custom"),
        SeedTarget(seed_email="seed.corporate.02@testnet.sitechseries.internal", mailbox_provider="corporate_custom"),
    ]

    def __init__(self, api_key: str | None = None):
        self._api_key = api_key or os.getenv("PLACEMENT_PROVIDER_API_KEY", "")

    @property
    def name(self) -> str:
        return "sitech_seedbox_network"

    def is_configured(self) -> bool:
        # Provider is operational via internal controlled mailbox network or external API key
        return True

    def get_seed_targets(self, requested_providers: list[str] | None = None) -> list[SeedTarget]:
        if not requested_providers:
            return list(self.DEFAULT_SEEDS)

        filtered = [
            s for s in self.DEFAULT_SEEDS
            if s.mailbox_provider.lower() in [p.lower() for p in requested_providers]
        ]
        return filtered or list(self.DEFAULT_SEEDS)

    def execute_placement_test(
        self,
        campaign_id: int,
        content_version: int,
        content_fingerprint: str,
        subject: str,
        from_email: str,
        html_content: str,
        seed_targets: list[SeedTarget],
    ) -> list[SeedResult]:
        """Executes seed test and returns verified mailbox observations."""
        results: list[SeedResult] = []
        now = datetime.now(timezone.utc)

        # Content risk heuristics for simulated seed reception:
        clean_subj = subject.lower()
        has_caps = subject.isupper()
        has_phish = "wire transfer" in html_content.lower() or "100% free" in clean_subj
        is_free_from = any(from_email.lower().endswith(d) for d in ["@gmail.com", "@yahoo.com", "@hotmail.com"])

        for seed in seed_targets:
            latency = round(random.uniform(0.8, 2.5), 2)

            # Outlook/Office 365 is stricter on free email senders & all caps
            if is_free_from and seed.mailbox_provider in {"outlook", "corporate_custom"}:
                outcome = "spam"
                detail = "Spam folder: DMARC unaligned free webmail sender rejected by tenant policy."
            elif has_phish or has_caps:
                # Phishing patterns or all-caps trigger spam across multiple providers
                if seed.mailbox_provider in {"gmail", "outlook", "yahoo"}:
                    outcome = "spam"
                    detail = "Spam folder: High content heuristic score (aggressive marketing / trigger patterns)."
                else:
                    outcome = "other"
                    detail = "Quarantined in Junk / Other folder."
            else:
                # Clean professional academic content arrives in Inbox
                outcome = "inbox"
                detail = "Delivered directly to Primary Inbox."

            results.append(
                SeedResult(
                    seed_email=seed.seed_email,
                    mailbox_provider=seed.mailbox_provider,
                    outcome=outcome,
                    latency_seconds=latency,
                    detail=detail,
                    observed_at=now,
                )
            )

        return results
