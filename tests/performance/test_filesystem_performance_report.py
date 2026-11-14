import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

from performance.path_performance_snapshot_io import PathPerformanceSnapshotIO
from performance.performance_report import PerformanceReport


class FilesystemPerformanceReportTest(unittest.TestCase):
    """Responsibilities: _real snapshot discovery_, _filesystem input deduplication_."""

    def test_discovers_nested_snapshots_and_deduplicates_overlapping_inputs(self) -> None:
        """Responsibilities: _nested snapshot discovery_, _input deduplication_."""
        with TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            nested = root / "runs" / "nested"
            nested.mkdir(parents=True)
            cold = nested / "cold_run.performance.md"
            warm = nested / "warm_run.performance.md"
            cold.write_text(
                "- Project root: `/project`\n- TypeScript files: 10\n- Python files: 2\n\n| startup | 10 sec |\n",
                encoding="utf-8",
            )
            warm.write_text(
                "- Project root: `/project`\n- TypeScript files: 10\n- Python files: 2\n\n| startup | 2 sec |\n",
                encoding="utf-8",
            )
            (nested / "notes.md").write_text("not a timing snapshot\n", encoding="utf-8")
            snapshot_io = PathPerformanceSnapshotIO()
            report_source = PerformanceReport([str(root), str(cold)], snapshot_io)
            report = report_source.markdown()

        self.assertEqual(report.count("| startup |"), 1)
        self.assertIn("| startup | 2.0 sec +- 0.0 | 10.0 sec +- 0.0 |", report)

    def test_reads_an_explicit_snapshot_file(self) -> None:
        """Responsibilities: _explicit snapshot file reading_."""
        with TemporaryDirectory() as temporary_directory:
            snapshot_path = Path(temporary_directory) / "cold_custom_report.performance.md"
            snapshot_path.write_text(
                "- Project root: `/project`\n- TypeScript files: 10\n- Python files: 2\n\n| startup | 8 sec |\n",
                encoding="utf-8",
            )
            snapshot_io = PathPerformanceSnapshotIO()
            report_source = PerformanceReport([str(snapshot_path)], snapshot_io)
            report = report_source.markdown()

        self.assertIn("| startup | — | 8.0 sec +- 0.0 |", report)
