"""Performance reporting contracts."""

from __future__ import annotations

from pathlib import Path
from typing import Protocol


class PerformanceSnapshotIOContract(Protocol):
    """Responsibilities: _snapshot discovery_, _snapshot content access_."""

    def snapshot_paths(self, inputs: list[str]) -> list[Path]:
        """Responsibilities: _snapshot path discovery_."""
        ...

    def snapshot_text(self, path: Path) -> str:
        """Responsibilities: _snapshot source text access_."""
        ...


class PerformanceWorkloadIdentityContract(Protocol):
    """Responsibilities: _comparable workload identity contract_."""

    def project_root(self) -> str:
        """Responsibilities: _project root identity access_."""
        ...

    def typescript_files(self) -> int:
        """Responsibilities: _TypeScript file-count identity access_."""
        ...

    def python_files(self) -> int:
        """Responsibilities: _Python file-count identity access_."""
        ...

    def matches(self, other: PerformanceWorkloadIdentityContract) -> bool:
        """Responsibilities: _workload identity comparison_."""
        ...


class PerformanceSnapshotContract(Protocol):
    """Responsibilities: _performance snapshot value contract_."""

    def stage_values(self) -> dict[str, float]:
        """Responsibilities: _performance stage value access_."""
        ...

    def file_counts(self) -> dict[str, int]:
        """Responsibilities: _performance file-count access_."""
        ...

    def mode_name(self) -> str:
        """Responsibilities: _performance snapshot mode access_."""
        ...

    def workload_identity(self) -> PerformanceWorkloadIdentityContract:
        """Responsibilities: _comparable workload identity access_."""
        ...

    def source_path(self) -> str:
        """Responsibilities: _snapshot source path access_."""
        ...


class PerformanceSnapshotsContract(Protocol):
    """Responsibilities: _performance snapshot collection contract_."""

    def file_counts(self) -> dict[str, int]:
        """Responsibilities: _performance file-count collection access_."""
        ...

    def stage_names(self) -> set[str]:
        """Responsibilities: _performance stage-name collection access_."""
        ...

    def values(self, mode: str, stage: str) -> list[float]:
        """Responsibilities: _performance stage values by mode access_."""
        ...

    def workloads_compatible(self) -> bool:
        """Responsibilities: _workload identity compatibility_."""
        ...
