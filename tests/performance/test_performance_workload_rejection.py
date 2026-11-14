import unittest
from io import StringIO
from pathlib import Path

from performance.performance_report import PerformanceReport
from performance.performance_snapshot_files import PerformanceSnapshotFiles
from tests.performance.in_memory_performance_snapshot_io import (
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
                ],
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

    def test_report_rejects_mismatched_workload_identities(self) -> None:
        """Responsibilities: _incompatible workload report result_."""
        snapshots = self._mismatched_snapshots("/first", 10, 2, "/second", 10, 2)
        report = PerformanceReport([str(path) for path in snapshots], InMemoryPerformanceSnapshotIO(snapshots))
        output = StringIO()
        errors = StringIO()

        status = report.write_report(output, errors)

        self.assertEqual((status, output.getvalue()), (1, ""))
        self.assertIn("different project roots or file counts", errors.getvalue())

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

    def test_rejects_equally_incomplete_workload_metadata(self) -> None:
        """Responsibilities: _equal incomplete workload rejection_."""
        path_one = Path("/virtual/cold_missing.performance.md")
        path_two = Path("/virtual/warm_missing.performance.md")
        incomplete = "| startup | 10 sec |\n"
        snapshots = {path_one: incomplete, path_two: incomplete}
        source = PerformanceSnapshotFiles(list(snapshots), InMemoryPerformanceSnapshotIO(snapshots))

        self.assertFalse(source.snapshot_collection().workloads_compatible())

    def test_rejects_a_single_incomplete_workload(self) -> None:
        """Responsibilities: _single incomplete workload rejection_."""
        path = Path("/virtual/cold_missing.performance.md")
        snapshots = {path: "| startup | 10 sec |\n"}
        source = PerformanceSnapshotFiles([path], InMemoryPerformanceSnapshotIO(snapshots))

        self.assertFalse(source.snapshot_collection().workloads_compatible())

    def test_rejects_a_single_incomplete_workload_at_collection_boundary(self) -> None:
        """Responsibilities: _public collection workload validation_."""
        path = Path("/virtual/cold_missing.performance.md")
        snapshots = {path: "| startup | 10 sec |\n"}
        report = PerformanceReport([str(path)], InMemoryPerformanceSnapshotIO(snapshots))
        output = StringIO()
        errors = StringIO()

        status = report.write_report(output, errors)

        self.assertEqual((status, output.getvalue()), (1, ""))
        self.assertIn("Incomplete performance workload identity", errors.getvalue())

    def test_rejects_empty_collection_at_public_boundary(self) -> None:
        """Responsibilities: _empty snapshot collection rejection_."""
        report = PerformanceReport([], InMemoryPerformanceSnapshotIO({}))
        output = StringIO()
        errors = StringIO()

        status = report.write_report(output, errors)

        self.assertEqual((status, output.getvalue()), (1, ""))
        self.assertIn("no performance snapshots found", errors.getvalue())

    def test_rejects_incomplete_first_snapshot_before_complete_snapshot(self) -> None:
        """Responsibilities: _first workload identity admission_."""
        incomplete = Path("/virtual/cold_missing.performance.md")
        complete = Path("/virtual/warm_complete.performance.md")
        snapshots = {
            incomplete: "| startup | 10 sec |\n",
            complete: "- Project root: `/project`\n- TypeScript files: 10\n- Python files: 2\n| startup | 2 sec |\n",
        }
        report = PerformanceReport([str(incomplete), str(complete)], InMemoryPerformanceSnapshotIO(snapshots))
        output = StringIO()
        errors = StringIO()

        status = report.write_report(output, errors)

        self.assertEqual((status, output.getvalue()), (1, ""))
        self.assertIn("Incomplete performance workload identity", errors.getvalue())

    def test_rejects_one_incomplete_workload_metadata(self) -> None:
        """Responsibilities: _incomplete workload metadata rejection_."""
        snapshots = self._snapshot("cold_complete.performance.md", "/project", 10, 2)
        snapshots.update({Path("/virtual/warm_missing.performance.md"): "| startup | 10 sec |\n"})
        source = PerformanceSnapshotFiles(list(snapshots), InMemoryPerformanceSnapshotIO(snapshots))

        self.assertFalse(source.snapshot_collection().workloads_compatible())

    def test_rejects_unknown_mode_prefix(self) -> None:
        """Responsibilities: _unknown snapshot mode rejection_."""
        path = Path("/virtual/unknown_run.performance.md")
        snapshots = {path: "- Project root: `/project`\n- TypeScript files: 1\n- Python files: 1\n"}
        report = PerformanceReport([str(path)], InMemoryPerformanceSnapshotIO(snapshots))
        output = StringIO()
        errors = StringIO()

        status = report.write_report(output, errors)

        self.assertEqual((status, output.getvalue()), (1, ""))
        self.assertIn("Invalid performance snapshot mode prefix", errors.getvalue())

    def test_rejects_missing_mode_prefix(self) -> None:
        """Responsibilities: _missing snapshot mode rejection_."""
        path = Path("/virtual/performance.md")
        snapshots = {path: "- Project root: `/project`\n- TypeScript files: 1\n- Python files: 1\n"}
        report = PerformanceReport([str(path)], InMemoryPerformanceSnapshotIO(snapshots))
        output = StringIO()
        errors = StringIO()

        status = report.write_report(output, errors)

        self.assertEqual((status, output.getvalue()), (1, ""))
        self.assertIn("Invalid performance snapshot mode prefix", errors.getvalue())

    def test_rejects_empty_mode_prefix(self) -> None:
        """Responsibilities: _empty snapshot mode rejection_."""
        path = Path("/virtual/_run.performance.md")
        snapshots = {path: "- Project root: `/project`\n- TypeScript files: 1\n- Python files: 1\n"}
        report = PerformanceReport([str(path)], InMemoryPerformanceSnapshotIO(snapshots))
        output = StringIO()
        errors = StringIO()

        status = report.write_report(output, errors)

        self.assertEqual((status, output.getvalue()), (1, ""))
        self.assertIn("Invalid performance snapshot mode prefix", errors.getvalue())
