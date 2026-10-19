from __future__ import annotations

import ast

from implementation.references.protocols import (
    PythonInstanceWriteLookupContract,
    PythonPositionedWriteContract,
)


class PythonInstanceWriteLookup(PythonInstanceWriteLookupContract):
    """Responsibilities: _positioned owner history_, _owner identity_."""

    _is_present: bool
    _owner_name: str
    _line_number: int
    _column_offset: int

    def __init__(
        self,
        is_present: bool,
        owner_name: str,
        line_number: int = -1,
        column_offset: int = -1,
    ) -> None:
        """Responsibilities: _lookup result fields_."""
        self._is_present: bool = is_present
        self._owner_name: str = owner_name
        self._line_number: int = line_number
        self._column_offset: int = column_offset

    def with_candidate(
        self,
        write: PythonPositionedWriteContract,
        node: ast.AST,
    ) -> PythonInstanceWriteLookupContract:
        """Responsibilities: _candidate ordering_."""
        if not write.visible_at(node):
            return self
        if self._is_present:
            if not write.at_or_after(self._line_number, self._column_offset):
                return self
        return PythonInstanceWriteLookup(
            True,
            write.owner_name(),
            write.line_number(),
            write.column_offset(),
        )

    def present(self) -> bool:
        """Responsibilities: _candidate existence_."""
        return self._is_present

    def owner_name(self) -> str:
        """Responsibilities: _instance owner name_."""
        return self._owner_name
