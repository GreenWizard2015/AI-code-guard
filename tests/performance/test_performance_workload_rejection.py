import unittest
from pathlib import Path

from performance.performance_snapshot_files import PerformanceSnapshotFiles
from tests.performance.test_performance_report_modes import (
    InMemoryPerformanceSnapshotIO,
)


class PerformanceWorkloadRejectionTest(unittest.TestCase):
    """Responsibilities: _project root compatibility_, _language file-count compatibility_."""

    def _snapshot(
        self,
        name: str,
        project_root: str,
        typescript_files: int,
        python_files: int,
    ) -> dict[Path, str]:
        """Responsibilities: _workload snapshot fixture creation_."""
        path = Path(f"/virtual/{name}")
        text = (
            "\n".join(
                [
                    f"- Project root: `{project_root}`",
                    f"- TypeScript files: {typescript_files}",
                    f"- Python files: {python_files}",
                    "",
                    "| startup | 10 sec |",
                ]
            )
            + "\n"
        )
        return {path: text}

    def _mismatched_snapshots(
        self,
        first_root: str,
        first_typescript_files: int,
        first_python_files: int,
        second_root: str,
        second_typescript_files: int,
        second_python_files: int,
    ) -> dict[Path, str]:
        """Responsibilities: _mismatched workload fixture creation_."""
        first = self._snapshot("cold_first.performance.md", first_root, first_typescript_files, first_python_files)
        second = self._snapshot("warm_second.performance.md", second_root, second_typescript_files, second_python_files)
        return {**first, **second}

    def test_identifies_different_project_roots(self) -> None:
        """Responsibilities: _project root compatibility_."""
        snapshots = self._mismatched_snapshots("/first", 10, 2, "/second", 10, 2)
        source = PerformanceSnapshotFiles(list(snapshots), InMemoryPerformanceSnapshotIO(snapshots))
        compatible = source.snapshot_collection().workloads_compatible()

        self.assertFalse(compatible)

    def test_identifies_different_typescript_file_counts(self) -> None:
        """Responsibilities: _TypeScript workload compatibility_."""
        snapshots = self._mismatched_snapshots("/project", 10, 2, "/project", 11, 2)
        source = PerformanceSnapshotFiles(list(snapshots), InMemoryPerformanceSnapshotIO(snapshots))
        compatible = source.snapshot_collection().workloads_compatible()

        self.assertFalse(compatible)

    def test_identifies_different_python_file_counts(self) -> None:
        """Responsibilities: _Python workload compatibility_."""
        snapshots = self._mismatched_snapshots("/project", 10, 2, "/project", 10, 3)
        source = PerformanceSnapshotFiles(list(snapshots), InMemoryPerformanceSnapshotIO(snapshots))
        compatible = source.snapshot_collection().workloads_compatible()

        self.assertFalse(compatible)
