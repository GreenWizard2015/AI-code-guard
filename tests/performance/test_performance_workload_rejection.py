import unittest
from pathlib import Path

from performance.performance_snapshot_files import PerformanceSnapshotFiles
from performance.performance_snapshot_input import PerformanceSnapshotInput
from performance.protocols import PerformanceSnapshotInputContract
from tests.performance.in_memory_performance_snapshot_io import (
    InMemoryPerformanceSnapshotIO,
)


class MismatchedWorkload:
    """Responsibilities: _first workload snapshot_, _second workload snapshot_."""

    def __init__(self, first: Path, second: Path, file_io: InMemoryPerformanceSnapshotIO) -> None:
        """Responsibilities: _mismatched workload fixture initialization_."""
        self.first: Path = first
        self.second: Path = second
        self.file_io: InMemoryPerformanceSnapshotIO = file_io


class PerformanceWorkloadRejectionTest(unittest.TestCase):
    """Responsibilities: _project root compatibility_, _language file-count compatibility_."""

    def _snapshot(
        self,
        name: str,
        project_root: str,
        typescript_files: int,
        python_files: int,
    ) -> PerformanceSnapshotInputContract:
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
        return PerformanceSnapshotInput(path, text)

    def _mismatched_snapshots(
        self,
        first_root: str,
        first_typescript_files: int,
        first_python_files: int,
        second_root: str,
        second_typescript_files: int,
        second_python_files: int,
    ) -> MismatchedWorkload:
        """Responsibilities: _mismatched workload fixture creation_."""
        first = self._snapshot("cold_first.performance.md", first_root, first_typescript_files, first_python_files)
        second = self._snapshot("warm_second.performance.md", second_root, second_typescript_files, second_python_files)
        file_io = InMemoryPerformanceSnapshotIO({first.path(): first.content(), second.path(): second.content()})
        return MismatchedWorkload(first.path(), second.path(), file_io)

    def test_identifies_different_project_roots(self) -> None:
        """Responsibilities: _project root compatibility_."""
        workload = self._mismatched_snapshots("/first", 10, 2, "/second", 10, 2)
        source = PerformanceSnapshotFiles([workload.first, workload.second], workload.file_io)
        compatible = source.snapshot_collection().workloads_compatible()

        self.assertFalse(compatible)

    def test_identifies_different_typescript_file_counts(self) -> None:
        """Responsibilities: _TypeScript workload compatibility_."""
        workload = self._mismatched_snapshots("/project", 10, 2, "/project", 11, 2)
        source = PerformanceSnapshotFiles([workload.first, workload.second], workload.file_io)
        compatible = source.snapshot_collection().workloads_compatible()

        self.assertFalse(compatible)

    def test_identifies_different_python_file_counts(self) -> None:
        """Responsibilities: _Python workload compatibility_."""
        workload = self._mismatched_snapshots("/project", 10, 2, "/project", 10, 3)
        source = PerformanceSnapshotFiles([workload.first, workload.second], workload.file_io)
        compatible = source.snapshot_collection().workloads_compatible()

        self.assertFalse(compatible)
