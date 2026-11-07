"""Aggregate and print diagnostic report findings."""

from __future__ import annotations

import sys
from collections import Counter
from pathlib import Path

from scripts.diagnostics_to_zero.protocols import (
    DiagnosticFindingContract,
    DiagnosticSummaryContract,
)


class DiagnosticSummary(DiagnosticSummaryContract):
    """Responsibilities: _issue count aggregation_, _snapshot comparison summary_."""

    def _print_top(self, label: str, counts: Counter[str], limit: int) -> None:
        """Responsibilities: _ranked group presentation_."""
        self._write_line(f"Top {label}:")
        ranked_counts = sorted(counts.items(), key=lambda item: (-item[1], item[0]))
        top_counts = ranked_counts[:limit]
        for name, count in top_counts:
            self._write_line(f"  {count:>5}  {name}")
        if not counts:
            self._write_line("  (none)")

    def _write_line(self, value: str) -> None:
        """Responsibilities: _summary output line writing_."""
        sys.stdout.write(f"{value}\n")

    def _missing_count(self, older: Counter[str], newer: Counter[str]) -> int:
        """Responsibilities: _snapshot delta counts_."""
        missing = 0
        for key, count in older.items():
            newer_count = newer.get(key, 0)
            missing += max(count - newer_count, 0)
        return missing

    def __init__(self, findings: list[DiagnosticFindingContract]) -> None:
        """Responsibilities: _issue collection state_."""
        self._findings: list[DiagnosticFindingContract] = findings

    def rule_counts(self) -> Counter[str]:
        """Responsibilities: _rule totals_."""
        return Counter(finding.rule_id() for finding in self._findings)

    def file_counts(self) -> Counter[str]:
        """Responsibilities: _source path totals_."""
        return Counter(finding.file_path() for finding in self._findings)

    def print_summary(self, limit: int) -> None:
        """Responsibilities: _report summary display_."""
        self._write_line(f"Total findings: {len(self._findings)}")
        self._write_line(f"Affected files: {len(self.file_counts())}")
        self._print_top("rules", self.rule_counts(), limit)
        self._print_top("files", self.file_counts(), limit)

    def print_comparison(self, previous: list[DiagnosticFindingContract], path: Path) -> None:
        """Responsibilities: _snapshot delta presentation_."""
        previous_counts = Counter(finding.fingerprint() for finding in previous)
        current_counts = Counter(finding.fingerprint() for finding in self._findings)
        resolved_total = self._missing_count(previous_counts, current_counts)
        new_total = self._missing_count(current_counts, previous_counts)
        persistent_total = sum(min(count, current_counts.get(key, 0)) for key, count in previous_counts.items())
        self._write_line(f"Compared with: {path}")
        self._write_line(f"Resolved findings: {resolved_total}")
        self._write_line(f"Persistent findings: {persistent_total}")
        self._write_line(f"New findings: {new_total}")
        self._write_line(f"Net change: {new_total - resolved_total:+d}")
