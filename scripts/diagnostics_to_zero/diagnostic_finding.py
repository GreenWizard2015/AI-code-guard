"""Represent a normalized diagnostic finding."""

from __future__ import annotations

import hashlib
import re


class DiagnosticFinding:
    """Responsibilities: _issue identity normalization_, _issue fingerprint generation_."""

    def _first_value(self, names: list[str], fallback: str) -> str:
        """Responsibilities: _field fallback lookup_."""
        for name in names:
            value = self._fields.get(name, "")
            if value:
                return value
        return fallback

    def __init__(self, fields: dict[str, str]) -> None:
        """Responsibilities: _identity field initialization_."""
        self._fields: dict[str, str] = fields

    def rule_id(self) -> str:
        """Responsibilities: _rule identifier selection_."""
        return self._first_value(["rule_id", "rule", "code"], "unknown-rule")

    def file_path(self) -> str:
        """Responsibilities: _source path normalization_."""
        path = self._first_value(["file", "path"], "unknown-file")
        return path.replace("\\", "/")

    def message(self) -> str:
        """Responsibilities: _message whitespace normalization_."""
        message = self._first_value(["message", "description"], "")
        return re.sub(r"\s+", " ", message).strip()

    def fingerprint(self) -> str:
        """Responsibilities: _identity digest generation_."""
        identity = f"{self.rule_id()}\0{self.file_path()}\0{self.message()}"
        return hashlib.sha256(identity.encode("utf-8")).hexdigest()
