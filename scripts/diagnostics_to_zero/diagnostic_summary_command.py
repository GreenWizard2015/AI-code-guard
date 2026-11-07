"""Run the diagnostic report summary command."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from scripts.diagnostics_to_zero.diagnostic_report import (
    DiagnosticReport,
)
from scripts.diagnostics_to_zero.diagnostic_summary import (
    DiagnosticSummary,
)
from scripts.diagnostics_to_zero.protocols import (
    DiagnosticReportContract,
    DiagnosticSummaryCommandContract,
    DiagnosticSummaryContract,
)


class DiagnosticSummaryCommand(DiagnosticSummaryCommandContract):
    """Responsibilities: _report option validation_, _report summary generation_."""

    def __init__(
        self,
        current_report: DiagnosticReportContract,
        previous_report: DiagnosticReportContract,
    ) -> None:
        """Responsibilities: _report collaborators initialization_."""
        self._current_report: DiagnosticReportContract = current_report
        self._previous_report: DiagnosticReportContract = previous_report

    def _current_summary(self, report_path: Path, limit: int) -> DiagnosticSummaryContract:
        """Responsibilities: _current report summary_."""
        findings = self._current_report.findings()
        snapshot = self._current_report.snapshot_id()
        sys.stdout.write(f"Current report: {report_path}\n")
        sys.stdout.write(f"Snapshot ID: {snapshot}\n")
        summary = DiagnosticSummary(findings)
        summary.print_summary(limit)
        return summary

    def _comparison_summary(self, report_path: Path, summary: DiagnosticSummaryContract) -> None:
        """Responsibilities: _prior snapshot comparison_."""
        previous_findings = self._previous_report.findings()
        summary.print_comparison(previous_findings, report_path)

    def run(self, options: argparse.Namespace) -> int:
        """Responsibilities: _report command execution_."""
        try:
            current_summary = self._current_summary(options.report, options.top)
            if options.compare is not None:
                self._comparison_summary(options.compare, current_summary)
        except ValueError as error:
            sys.stderr.write(f"error: {error}\n")
            return 2
        return 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Summarize diagnostic JSON findings.")
    parser.add_argument("report", type=Path, help="current diagnostic report JSON")
    parser.add_argument("--compare", type=Path, help="previous diagnostic report JSON")
    parser.add_argument("--top", type=int, default=10, help="number of groups to show (default: 10)")
    options = parser.parse_args()
    if options.top < 1:
        parser.error("--top must be at least 1")
    current_report = DiagnosticReport(options.report)
    previous_report = DiagnosticReport(options.compare or options.report)
    command: DiagnosticSummaryCommandContract = DiagnosticSummaryCommand(current_report, previous_report)
    raise SystemExit(command.run(options))
