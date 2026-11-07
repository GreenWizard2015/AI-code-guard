"""Performance snapshot collection."""

from __future__ import annotations

from performance.protocols import (
    PerformanceSnapshotContract,
    PerformanceSnapshotsContract,
)


class PerformanceSnapshots:
    """Responsibilities: _snapshot collection_, _mode-specific stage selection_."""

    def _validate_complete_workloads(self) -> None:
        """Responsibilities: _complete workload identity admission_."""
        for snapshot in self._snapshots:
            identity = snapshot.workload_identity()
            if identity.complete():
                continue
            raise ValueError(f"Incomplete performance workload identity in {snapshot.source_path()}.")

    def _validate_matching_workloads(self) -> None:
        """Responsibilities: _matching workload identity admission_."""
        if self.workloads_compatible():
            return
        first = self._snapshots[0]
        expected = first.workload_identity()
        for snapshot in self._snapshots[1:]:
            if snapshot.workload_identity().matches(expected):
                continue
            raise ValueError(
                "Incompatible performance workloads: "
                f"{first.source_path()} and {snapshot.source_path()} have different project roots or file counts.",
            )

    def __init__(self, snapshots: list[PerformanceSnapshotContract]) -> None:
        """Responsibilities: _performance snapshot collection initialization_."""
        self._snapshots: list[PerformanceSnapshotContract] = list(snapshots)

    def validated(self) -> PerformanceSnapshotsContract:
        """Responsibilities: _snapshot validation_."""
        if not self._snapshots:
            raise ValueError("Cannot validate an empty performance snapshot collection.")
        self._validate_complete_workloads()
        self._validate_matching_workloads()
        return self

    def workloads_compatible(self) -> bool:
        """Responsibilities: _workload identity compatibility_."""
        snapshots = self._snapshots
        if not snapshots:
            return False
        if any(not snapshot.workload_identity().complete() for snapshot in snapshots):
            return False
        if len(snapshots) < 2:
            return True
        first = snapshots[0]
        expected = first.workload_identity()
        return all(snapshot.workload_identity().matches(expected) for snapshot in snapshots[1:])

    def file_counts(self) -> dict[str, int]:
        """Responsibilities: _first snapshot file-count access_."""
        return self._snapshots[0].file_counts()

    def stage_names(self) -> set[str]:
        """Responsibilities: _stage name collection_."""
        return {stage for snapshot in self._snapshots for stage in snapshot.stage_values()}

    def values(self, mode: str, stage: str) -> list[float]:
        """Responsibilities: _mode-specific stage value selection_."""
        selected: list[float] = []
        for snapshot in self._snapshots:
            if snapshot.mode_name() != mode:
                continue
            stage_values = snapshot.stage_values()
            if stage in stage_values:
                selected.append(stage_values[stage])
        return selected
