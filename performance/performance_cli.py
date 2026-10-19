from __future__ import annotations

import argparse
from pathlib import Path

from performance.constants import NO_PERFORMANCE_SNAPSHOTS_MESSAGE
from performance.performance_report import PerformanceReport
from performance.path_performance_snapshot_io import PathPerformanceSnapshotIO


class PerformanceCli:
    """Responsibilities: _performance snapshot argument parsing_, _report output_."""

    def __init__(self) -> None:
        """Responsibilities: _performance CLI configuration initialization_."""
        self.description: str = "Combine linter performance snapshots into one Markdown report."

    def arguments(self) -> argparse.Namespace:
        """Responsibilities: _performance CLI argument parsing_."""
        parser = argparse.ArgumentParser(description=self.description)
        parser.add_argument("snapshots", nargs="+", help="performance.md files or directories")
        parser.add_argument("-o", "--output", type=Path, help="write Markdown to this file")
        return parser.parse_args()

    def run(self) -> None:
        """Responsibilities: _performance report generation_."""
        options = self.arguments()
        report = PerformanceReport(options.snapshots, PathPerformanceSnapshotIO())
        if not report.snapshots_available():
            raise SystemExit(NO_PERFORMANCE_SNAPSHOTS_MESSAGE)
        try:
            output = report.markdown()
        except ValueError as error:
            raise SystemExit(str(error)) from error
        if options.output is None:
            print(output, end="")
        if options.output is not None:
            options.output.write_text(output, encoding="utf-8")
