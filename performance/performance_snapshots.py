"""Performance snapshot collection."""

from __future__ import annotations

from performance.protocols import PerformanceSnapshotContract


class PerformanceSnapshots:
    """Responsibilities: _snapshot collection_, _mode-specific stage selection_."""

    def _validate_workloads(self, snapshots: list[PerformanceSnapshotContract]) -> None:
        """Responsibilities: _comparable workload validation_."""
        if self.workloads_compatible():
            return
        first = snapshots[0]
        expected = first.workload_identity()
        for snapshot in snapshots[1:]:
            if snapshot.workload_identity().matches(expected):
                continue
            raise ValueError(
                "Incompatible performance workloads: "
                f"{first.source_path()} and {snapshot.source_path()} have different project roots or file counts."
            )

    def __init__(self, snapshots: list[PerformanceSnapshotContract]) -> None:
        """Responsibilities: _performance snapshot collection initialization_."""
        self.snapshots: list[PerformanceSnapshotContract] = snapshots

    def validated(self) -> PerformanceSnapshotsContract:
        """Responsibilities: _snapshot validation_."""
        self._validate_workloads(self.snapshots)
        return self

    def workloads_compatible(self) -> bool:
        """Responsibilities: _workload identity compatibility_."""
        snapshots = self.snapshots
        if len(snapshots) < 2:
            return True
        first = snapshots[0]
        expected = first.workload_identity()
        for snapshot in snapshots[1:]:
            if not snapshot.workload_identity().matches(expected):
                return False
        return True

    def file_counts(self) -> dict[str, int]:
        """Responsibilities: _first snapshot file-count access_."""
        return self.snapshots[0].file_counts()

    def stage_names(self) -> set[str]:
        """Responsibilities: _stage name collection_."""
        return {stage for snapshot in self.snapshots for stage in snapshot.stage_values()}

    def values(self, mode: str, stage: str) -> list[float]:
        """Responsibilities: _mode-specific stage value selection_."""
        selected: list[float] = []
        for snapshot in self.snapshots:
            if snapshot.mode_name() != mode:
                continue
            stage_values = snapshot.stage_values()
            if stage in stage_values:
                selected.append(stage_values[stage])
        return selected
