"""Decode a diagnostic report into finding records."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

from scripts.diagnostics_to_zero.diagnostic_finding import DiagnosticFinding
from scripts.diagnostics_to_zero.protocols import (
    DiagnosticFindingContract,
    DiagnosticReportContract,
)


class DiagnosticReport(DiagnosticReportContract):
    """Responsibilities: _report JSON decoding_, _record shape validation_."""

    def _decode_findings(self, content: str) -> list[DiagnosticFindingContract]:
        """Responsibilities: _report record decoding_, _record schema validation_."""
        try:
            payload = json.loads(content)
        except json.JSONDecodeError as error:
            raise ValueError(f"Invalid JSON report {self._path}: {error}") from error
        if type(payload) is dict:
            payload = next(
                (
                    payload.get(name)
                    for name in ("violations", "findings", "diagnostics")
                    if type(payload.get(name)) is list
                ),
                None,
            )
        if type(payload) is not list or any(type(item) is not dict for item in payload):
            raise ValueError(f"{self._path} must be a findings list of objects")
        return [
            DiagnosticFinding({name: str(value) for name, value in item.items() if type(name) is str and value})
            for item in payload
        ]

    def __init__(self, path: Path) -> None:
        """Responsibilities: _diagnostic report path initialization_."""
        self._path: Path = path

    def findings(self) -> list[DiagnosticFindingContract]:
        """Responsibilities: _report record collection_."""
        try:
            content = self._path.read_text(encoding="utf-8")
        except OSError as error:
            raise ValueError(f"Cannot open JSON report {self._path}: {error}") from error
        return self._decode_findings(content)

    def snapshot_id(self) -> str:
        """Responsibilities: _diagnostic report snapshot identification_."""
        try:
            content = self._path.read_bytes()
        except OSError as error:
            raise ValueError(f"Cannot hash JSON report {self._path}: {error}") from error
        digest = hashlib.sha256(content)
        digest_text = digest.hexdigest()
        return digest_text[:16]
