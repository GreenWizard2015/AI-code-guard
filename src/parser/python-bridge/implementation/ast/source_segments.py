from __future__ import annotations
from typing import Any


import ast


class SourceSegments:
    """Responsibilities: _validation Python source spans_."""

    def _valid_span(self, node: ast.AST) -> bool:
        """Responsibilities: _AST node span classification_."""
        if node.lineno is None or node.end_lineno is None:
            return False
        if node.col_offset is None or node.end_col_offset is None:
            return False
        if node.lineno <= 0:
            return False
        return node.end_lineno <= self.line_count()

    def __init__(self, source: str) -> None:
        """Responsibilities: _initialization source text split_."""
        self.lines: Any = ast._splitlines_no_ff(source)

    def line_count(self) -> int:
        """Responsibilities: _output number source lines_."""
        return len(self.lines)

    def significant_characters(self, text: str) -> int:
        """Responsibilities: _source non-whitespace character count_."""
        return len("".join(text.split()))

    def segment(self, node: ast.AST) -> str:
        """Responsibilities: _output source segment represented_."""
        if not self._valid_span(node):
            return ""
        line: Any = node.lineno - 1
        end_line: Any = node.end_lineno - 1
        if end_line == line:
            return (
                self.lines[line]
                .encode()[node.col_offset : node.end_col_offset]
                .decode()
            )
        first: Any = self.lines[line].encode()[node.col_offset :].decode()
        last: Any = self.lines[end_line].encode()[: node.end_col_offset].decode()
        return first + "".join(self.lines[line + 1 : end_line]) + last
