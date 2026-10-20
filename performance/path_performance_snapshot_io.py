"""Operating-system snapshot discovery and reading."""

from __future__ import annotations

from pathlib import Path

from performance.constants import PERFORMANCE_SNAPSHOT_SUFFIX, TEXT_ENCODING
from performance.protocols import PerformanceSnapshotIOContract


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
                paths.extend(sorted(path.rglob(f"*{PERFORMANCE_SNAPSHOT_SUFFIX}")))
            if path.is_file():
                paths.append(path)
        return paths

    def snapshot_text(self, path: Path) -> str:
        """Responsibilities: _snapshot text reading_."""
        return path.read_text(encoding=TEXT_ENCODING)
