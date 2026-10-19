from pathlib import Path

from performance.performance_snapshot_input import PerformanceSnapshotInput
from performance.protocols import PerformanceSnapshotInputContract

class InMemoryPerformanceSnapshotIO:
    """Responsibilities: _virtual snapshot lookup_, _snapshot text retrieval_."""

    def __init__(self, snapshots: dict[Path, str]) -> None:
        """Responsibilities: _snapshot collection initialization_."""
        self.snapshots: dict[Path, str] = snapshots

    def snapshot_paths(self, inputs: list[str]) -> list[Path]:
        """Responsibilities: _snapshot path selection_."""
        return [Path(value) for value in inputs if Path(value) in self.snapshots]

    def snapshot_input(self, path: Path) -> PerformanceSnapshotInputContract:
        """Responsibilities: _snapshot input lookup_."""
        return PerformanceSnapshotInput(path, self.snapshots[path])
