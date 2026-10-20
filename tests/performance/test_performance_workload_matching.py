import unittest
from pathlib import Path

from performance.performance_report import PerformanceReport
from performance.performance_snapshot_files import PerformanceSnapshotFiles
from tests.performance.test_performance_report_modes import (
    InMemoryPerformanceSnapshotIO,
)


class PerformanceWorkloadMatchingTest(unittest.TestCase):
    """Responsibilities: _workload snapshot preparation_, _workload compatibility checks_."""

    """Responsibilities: _matching workload aggregation verification_."""

    def _snapshot(self, name: str, startup: int) -> dict[Path, str]:
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
        return {path: content}

    def test_accepts_matching_workloads(self) -> None:
        """Responsibilities: _matching workload aggregation_."""
        snapshots = [
            self._snapshot("cold_first.performance.md", 10),
            self._snapshot("warm_second.performance.md", 2),
        ]
        snapshot_values = {path: content for snapshot in snapshots for path, content in snapshot.items()}
        report_source = PerformanceReport(
            [str(path) for path in snapshot_values], InMemoryPerformanceSnapshotIO(snapshot_values)
        )
        report = report_source.markdown()

        self.assertIn("| startup | 2.0 sec +- 0.0 | 10.0 sec +- 0.0 |", report)

    def test_accepts_same_root_and_file_counts_for_both_languages(self) -> None:
        """Responsibilities: _workload metadata compatibility result_."""
        snapshots = [
            self._snapshot("cold_first.performance.md", 10),
            self._snapshot("warm_second.performance.md", 2),
        ]
        snapshot_values = {path: content for snapshot in snapshots for path, content in snapshot.items()}
        source = PerformanceSnapshotFiles(list(snapshot_values), InMemoryPerformanceSnapshotIO(snapshot_values))
        compatible = source.snapshot_collection().workloads_compatible()

        self.assertTrue(compatible)
