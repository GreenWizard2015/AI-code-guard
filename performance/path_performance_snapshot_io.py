"""Operating-system snapshot discovery and reading."""

from __future__ import annotations

from pathlib import Path

from performance.performance_snapshot_input import PerformanceSnapshotInput
from performance.protocols import PerformanceSnapshotIOContract, PerformanceSnapshotInputContract


class PathPerformanceSnapshotIO(PerformanceSnapshotIOContract):
    """Responsibilities: _filesystem snapshot discovery_, _snapshot reading_."""

    def __init__(self) -> None:
        """Responsibilities: _snapshot I/O initialization_."""

    def snapshot_paths(self, inputs: list[str]) -> list[Path]:
        """Responsibilities: _snapshot path discovery_."""
        paths: list[Path] = []
        for value in inputs:
            path = Path(value)
            if path.is_dir():
                paths.extend(sorted(path.rglob("*.performance.md")))
            if path.is_file():
                paths.append(path)
        return paths

    def snapshot_input(self, path: Path) -> PerformanceSnapshotInputContract:
        """Responsibilities: _snapshot input reading_."""
        return PerformanceSnapshotInput(path, path.read_text(encoding="utf-8"))
