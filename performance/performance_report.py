"""Performance report domain model."""

from __future__ import annotations

import statistics
from performance.constants import PYTHON_FILES_KEY, TYPESCRIPT_FILES_KEY
from performance.performance_snapshot_files import PerformanceSnapshotFiles
from performance.protocols import PerformanceSnapshotIOContract, PerformanceSnapshotsContract
from performance.constants import NO_PERFORMANCE_SNAPSHOTS_MESSAGE


class PerformanceReport:
    """Responsibilities: _snapshot discovery_, _report aggregation_, _markdown rendering_."""

    def _header(self, file_counts: dict[str, int]) -> list[str]:
        """Responsibilities: _performance summary header rendering_."""
        typescript_count = file_counts.get(TYPESCRIPT_FILES_KEY, 0)
        python_count = file_counts.get(PYTHON_FILES_KEY, 0)
        return [
            "# Linter performance summary",
            "",
            f"- TypeScript files: {typescript_count}",
            f"- Python files: {python_count}",
            f"- Total files: {typescript_count + python_count}",
            "",
            "| Stage | With cache | Without cache |",
            "| --- | ---: | ---: |",
        ]

    def _rows(self, snapshots: PerformanceSnapshotsContract) -> list[str]:
        """Responsibilities: _performance summary rows rendering_."""
        rows: list[str] = []
        for stage in sorted(snapshots.stage_names()):
            warm_values = snapshots.values("warm", stage)
            cold_values = snapshots.values("cold", stage)
            rows.append(self._row(stage, warm_values, cold_values))
        return rows

    def _row(self, stage: str, warm_values: list[float], cold_values: list[float]) -> str:
        """Responsibilities: _performance stage row rendering_."""
        warm_value = "—"
        if warm_values:
            warm_value = self._timing_spread(warm_values)
        cold_value = "—"
        if cold_values:
            cold_value = self._timing_spread(cold_values)
        return f"| {stage} | {warm_value} | {cold_value} |"

    def _timing_spread(self, values: list[float]) -> str:
        """Responsibilities: _timing spread formatting_."""
        average = statistics.mean(values)
        deviation = 0.0
        if len(values) > 1:
            deviation = statistics.pstdev(values)
        return f"{average:.1f} sec +- {deviation:.1f}"

    def __init__(self, inputs: list[str], file_io: PerformanceSnapshotIOContract) -> None:
        """Responsibilities: _performance report input initialization_."""
        self.inputs: list[str] = inputs
        self.file_io: PerformanceSnapshotIOContract = file_io

    def markdown(self) -> str:
        """Responsibilities: _performance summary markdown rendering_."""
        source = PerformanceSnapshotFiles(self.file_io.snapshot_paths(self.inputs), self.file_io)
        if not source.source_available():
            raise ValueError(NO_PERFORMANCE_SNAPSHOTS_MESSAGE)
        snapshots = source.collection()
        rows = self._header(snapshots.file_counts())
        rows.extend(self._rows(snapshots))
        return "\n".join(rows) + "\n"

    def snapshots_available(self) -> bool:
        """Responsibilities: _performance snapshot availability_."""
        return len(self.file_io.snapshot_paths(self.inputs)) > 0
