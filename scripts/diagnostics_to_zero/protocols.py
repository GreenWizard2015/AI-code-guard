"""Define diagnostic summary contracts."""

from argparse import Namespace
from collections import Counter
from pathlib import Path
from typing import Protocol


class DiagnosticFindingContract(Protocol):
    """Responsibilities: _issue identity contract_, _source location contract_."""

    def rule_id(self) -> str: ...
    def file_path(self) -> str: ...
    def message(self) -> str: ...
    def fingerprint(self) -> str: ...


class DiagnosticReportContract(Protocol):
    """Responsibilities: _report records contract_, _snapshot identity contract_."""

    def findings(self) -> list[DiagnosticFindingContract]: ...
    def snapshot_id(self) -> str: ...


class DiagnosticSummaryContract(Protocol):
    """Responsibilities: _report summary contract_, _snapshot comparison contract_."""

    def rule_counts(self) -> Counter[str]: ...
    def file_counts(self) -> Counter[str]: ...
    def print_summary(self, limit: int) -> None: ...
    def print_comparison(self, previous: list[DiagnosticFindingContract], path: Path) -> None: ...


class DiagnosticSummaryCommandContract(Protocol):
    """Responsibilities: _summary execution contract_."""

    def run(self, options: Namespace) -> int: ...
