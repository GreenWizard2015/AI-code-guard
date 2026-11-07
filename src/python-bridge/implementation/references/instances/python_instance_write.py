from __future__ import annotations

import ast

from implementation.references.protocols import PythonPositionedWriteContract


class PythonInstanceWrite(PythonPositionedWriteContract):
    """Responsibilities: _source position ordering_, _instance owner identity_."""

    _line_number: int
    _column_offset: int
    _owner_name: str

    def __init__(self, line_number: int, column_offset: int, owner_name: str) -> None:
        """Responsibilities: _source position data_."""
        self._line_number: int = line_number
        self._column_offset: int = column_offset
        self._owner_name: str = owner_name

    def line_number(self) -> int:
        """Responsibilities: _source line lookup_."""
        return self._line_number

    def column_offset(self) -> int:
        """Responsibilities: _source column lookup_."""
        return self._column_offset

    def owner_name(self) -> str:
        """Responsibilities: _instance owner lookup_."""
        return self._owner_name

    def at_or_after(self, line_number: int, column_offset: int) -> bool:
        """Responsibilities: _source position ordering_."""
        return (self._line_number, self._column_offset) >= (line_number, column_offset)

    def visible_at(self, node: ast.AST) -> bool:
        """Responsibilities: _source order visibility_."""
        return (self._line_number, self._column_offset) <= (
            node.lineno,
            node.col_offset,
        )
