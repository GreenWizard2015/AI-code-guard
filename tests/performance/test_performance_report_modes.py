import unittest
from pathlib import Path

from performance.performance_report import PerformanceReport
from performance.performance_snapshot_input import PerformanceSnapshotInput
from performance.protocols import PerformanceSnapshotInputContract
from tests.performance.in_memory_performance_snapshot_io import (
    InMemoryPerformanceSnapshotIO,
)


class PerformanceReportModesTest(unittest.TestCase):
    """Responsibilities: _performance snapshot preparation_, _report mode aggregation checks_."""

    """Responsibilities: _performance mode aggregation verification_."""

    def _snapshot(
        self,
        name: str,
        startup: int,
        cold_only: bool = False,
        warm_only: bool = False,
    ) -> PerformanceSnapshotInputContract:
        """Responsibilities: _mode snapshot fixture creation_."""
        path = Path(f"/virtual/{name}")
        lines = [
            "- Project root: `/project`",
            "- TypeScript files: 10",
            "- Python files: 2",
            "",
            f"| startup | {startup} sec |",
        ]
        if cold_only:
            lines.append(f"| cold-only | {startup} sec |")
        if warm_only:
            lines.append(f"| warm-only | {startup} sec |")
        return PerformanceSnapshotInput(path, "\n".join(lines) + "\n")

    def _matching_snapshots(self) -> dict[Path, str]:
        """Responsibilities: _matching mode snapshot fixtures_."""
        snapshots = [
            self._snapshot("cold_first.performance.md", 10, True),
            self._snapshot("cold_second.performance.md", 14, True),
            self._snapshot("warm_first.performance.md", 2, False, True),
            self._snapshot("warm_second.performance.md", 4, False, True),
        ]
        return {snapshot.path(): snapshot.content() for snapshot in snapshots}

    def test_aggregates_cold_and_warm_stage_medians_separately(self) -> None:
        """Responsibilities: _cold/warm stage aggregation_."""
        snapshots = self._matching_snapshots()
        report_source = PerformanceReport([str(path) for path in snapshots], InMemoryPerformanceSnapshotIO(snapshots))
        report = report_source.markdown()

        self.assertEqual(
            "| startup | 3.0 sec +- 1.0 | 12.0 sec +- 2.0 |" in report,
            True,
        )

    def test_marks_missing_cold_or_warm_stage_values(self) -> None:
        """Responsibilities: _missing mode data result_."""
        snapshots = self._matching_snapshots()
        report_source = PerformanceReport([str(path) for path in snapshots], InMemoryPerformanceSnapshotIO(snapshots))
        report = report_source.markdown()

        self.assertEqual(
            {
                "cold_only": "| cold-only | — | 12.0 sec +- 2.0 |" in report,
                "warm_only": "| warm-only | 3.0 sec +- 1.0 | — |" in report,
            },
            {"cold_only": True, "warm_only": True},
        )
