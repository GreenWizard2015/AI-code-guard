import unittest
from io import StringIO
from pathlib import Path
from tempfile import TemporaryDirectory

from performance.path_performance_snapshot_io import PathPerformanceSnapshotIO
from performance.performance_report import PerformanceReport


class InMemoryPerformanceSnapshotIO:
    """Responsibilities: _virtual snapshot lookup_, _snapshot text retrieval_."""

    def __init__(self, snapshots: dict[Path, str]) -> None:
        """Responsibilities: _snapshot collection initialization_."""
        self._snapshots: dict[Path, str] = snapshots

    def snapshot_paths(self, inputs: list[str]) -> list[Path]:
        """Responsibilities: _snapshot path selection_."""
        return [Path(value) for value in inputs if Path(value) in self._snapshots]

    def snapshot_text(self, path: Path) -> str:
        """Responsibilities: _snapshot source text lookup_."""
        return self._snapshots[path]


class PerformanceReportModesTest(unittest.TestCase):
    """Responsibilities: _performance snapshot preparation_, _report mode aggregation checks_."""

    """Responsibilities: _performance mode aggregation verification_."""

    def _snapshot(
        self,
        name: str,
        startup: int,
        cold_only: bool = False,
        warm_only: bool = False,
    ) -> dict[Path, str]:
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
        return {path: "\n".join(lines) + "\n"}

    def _matching_snapshots(self) -> dict[Path, str]:
        """Responsibilities: _matching mode snapshot fixtures_."""
        snapshots = [
            self._snapshot("cold_first.performance.md", 10, cold_only=True),
            self._snapshot("cold_second.performance.md", 14, cold_only=True),
            self._snapshot("warm_first.performance.md", 2, cold_only=False, warm_only=True),
            self._snapshot("warm_second.performance.md", 4, cold_only=False, warm_only=True),
        ]
        return {path: content for snapshot in snapshots for path, content in snapshot.items()}

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

    def test_execution_writes_the_existing_successful_report(self) -> None:
        """Responsibilities: _successful report result delivery_."""
        snapshots = self._matching_snapshots()
        report_source = PerformanceReport([str(path) for path in snapshots], InMemoryPerformanceSnapshotIO(snapshots))
        expected_report = report_source.markdown()
        output = StringIO()
        errors = StringIO()

        status = report_source.write_report(output, errors)

        self.assertEqual((status, output.getvalue(), errors.getvalue()), (0, expected_report, ""))


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
