from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime
from typing import Literal

PlacementOutcome = Literal["inbox", "spam", "other", "unknown", "failed"]


@dataclass
class SeedTarget:
    seed_email: str
    mailbox_provider: str  # gmail, outlook, yahoo, apple_mail, corporate_custom


@dataclass
class SeedResult:
    seed_email: str
    mailbox_provider: str
    outcome: PlacementOutcome
    latency_seconds: float | None = None
    detail: str | None = None
    observed_at: datetime | None = None


class BasePlacementProvider(ABC):
    """Abstract interface for email deliverability mailbox placement testing providers."""

    @property
    @abstractmethod
    def name(self) -> str:
        """Unique provider identifier."""
        pass

    @abstractmethod
    def is_configured(self) -> bool:
        """Return True if required provider credentials / endpoints are configured."""
        pass

    @abstractmethod
    def get_seed_targets(self, requested_providers: list[str] | None = None) -> list[SeedTarget]:
        """Return the controlled mailbox seed targets for testing."""
        pass

    @abstractmethod
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
        """Dispatch test messages and collect normalized mailbox placement results."""
        pass
