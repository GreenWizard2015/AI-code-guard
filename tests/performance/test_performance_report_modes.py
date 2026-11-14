import unittest
from collections.abc import Iterator
from contextlib import contextmanager
from io import StringIO
from pathlib import Path
from tempfile import TemporaryDirectory

from performance.path_performance_snapshot_io import PathPerformanceSnapshotIO
from performance.performance_report import PerformanceReport


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

    @contextmanager
    def _snapshot_paths(self, snapshots: dict[Path, str]) -> Iterator[list[Path]]:
        """Responsibilities: _temporary performance snapshot files_."""
        with TemporaryDirectory() as temporary_directory:
            paths: list[Path] = []
            for source_path, content in snapshots.items():
                target_path = Path(temporary_directory) / source_path.name
                target_path.write_text(content, encoding="utf-8")
                paths.append(target_path)
            yield paths

    def test_aggregates_cold_and_warm_stage_medians_separately(self) -> None:
        """Responsibilities: _cold/warm stage aggregation_."""
        snapshots = self._matching_snapshots()
        with self._snapshot_paths(snapshots) as paths:
            report_source = PerformanceReport([str(path) for path in paths], PathPerformanceSnapshotIO())
            report = report_source.markdown()

        self.assertEqual(
            "| startup | 3.0 sec +- 1.0 | 12.0 sec +- 2.0 |" in report,
            True,
        )

    def test_marks_missing_cold_or_warm_stage_values(self) -> None:
        """Responsibilities: _missing mode data result_."""
        snapshots = self._matching_snapshots()
        with self._snapshot_paths(snapshots) as paths:
            report_source = PerformanceReport([str(path) for path in paths], PathPerformanceSnapshotIO())
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
        output = StringIO()
        errors = StringIO()
        with self._snapshot_paths(snapshots) as paths:
            report_source = PerformanceReport([str(path) for path in paths], PathPerformanceSnapshotIO())
            expected_report = report_source.markdown()
            status = report_source.write_report(output, errors)

        self.assertEqual((status, output.getvalue(), errors.getvalue()), (0, expected_report, ""))
