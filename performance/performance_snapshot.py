"""Performance snapshot value model."""

from __future__ import annotations

from performance.constants import (
    PROJECT_ROOT_KEY,
    PYTHON_FILES_KEY,
    TYPESCRIPT_FILES_KEY,
)
from performance.performance_workload_identity import PerformanceWorkloadIdentity
from performance.protocols import PerformanceWorkloadIdentityContract


class PerformanceSnapshot:
    """Responsibilities: _performance snapshot values_, _file-count values_, _stage mode classification_."""

    def __init__(self, values: dict[str, str], mode: str, source_path: str) -> None:
        """Responsibilities: _performance snapshot state initialization_."""
        self.values: dict[str, str] = values
        self.mode: str = mode
        self.source: str = source_path

    def stage_values(self) -> dict[str, float]:
        """Responsibilities: _performance stage value conversion_."""
        stage_values: dict[str, float] = {}
        for key, value in self.values.items():
            if not key.startswith("stage:"):
                continue
            stage_values[key.removeprefix("stage:")] = float(value)
        return stage_values

    def file_counts(self) -> dict[str, int]:
        """Responsibilities: _performance language file-count conversion_."""
        file_counts: dict[str, int] = {}
        for key, value in self.values.items():
            if not key.endswith("_files"):
                continue
            file_counts[key] = int(value)
        return file_counts

    def mode_name(self) -> str:
        """Responsibilities: _performance snapshot mode access_."""
        return self.mode

    def workload_identity(self) -> PerformanceWorkloadIdentityContract:
        """Responsibilities: _comparable workload identity construction_."""
        counts = self.file_counts()
        return PerformanceWorkloadIdentity(
            self.values.get(PROJECT_ROOT_KEY, ""),
            counts.get(TYPESCRIPT_FILES_KEY, 0),
            counts.get(PYTHON_FILES_KEY, 0),
        )

    def source_path(self) -> str:
        """Responsibilities: _snapshot source path access_."""
        return self.source
