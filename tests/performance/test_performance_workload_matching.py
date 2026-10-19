import unittest
from pathlib import Path

from performance.performance_report import PerformanceReport
from performance.performance_snapshot_files import PerformanceSnapshotFiles
from performance.performance_snapshot_input import PerformanceSnapshotInput
from performance.protocols import PerformanceSnapshotInputContract
from tests.performance.in_memory_performance_snapshot_io import (
    InMemoryPerformanceSnapshotIO,
)


class PerformanceWorkloadMatchingTest(unittest.TestCase):
    """Responsibilities: _workload snapshot preparation_, _workload compatibility checks_."""

    """Responsibilities: _matching workload aggregation verification_."""

    def _snapshot(self, name: str, startup: int) -> PerformanceSnapshotInputContract:
        """Responsibilities: _matching workload fixture creation_."""
        path = Path(f"/virtual/{name}")
        content = (
            "\n".join(
                [
                    "- Project root: `/project`",
                    "- TypeScript files: 10",
                    "- Python files: 2",
                    "",
                    f"| startup | {startup} sec |",
                ]
            )
            + "\n"
        )
        return PerformanceSnapshotInput(path, content)

    def test_accepts_matching_workloads(self) -> None:
        """Responsibilities: _matching workload aggregation_."""
        snapshot_values = [
            self._snapshot("cold_first.performance.md", 10),
            self._snapshot("warm_second.performance.md", 2),
        ]
        snapshots = {snapshot.path(): snapshot.content() for snapshot in snapshot_values}
        report_source = PerformanceReport([str(path) for path in snapshots], InMemoryPerformanceSnapshotIO(snapshots))
        report = report_source.markdown()

        self.assertIn("| startup | 2.0 sec +- 0.0 | 10.0 sec +- 0.0 |", report)

    def test_accepts_same_root_and_file_counts_for_both_languages(self) -> None:
        """Responsibilities: _workload metadata compatibility result_."""
        snapshot_values = [
            self._snapshot("cold_first.performance.md", 10),
            self._snapshot("warm_second.performance.md", 2),
        ]
        snapshots = {snapshot.path(): snapshot.content() for snapshot in snapshot_values}
        source = PerformanceSnapshotFiles(list(snapshots), InMemoryPerformanceSnapshotIO(snapshots))
        compatible = source.snapshot_collection().workloads_compatible()

        self.assertTrue(compatible)
