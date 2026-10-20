from __future__ import annotations

import ast
from typing import Any


class SourceSegments:
    """Responsibilities: _source span validation_, _segment extraction and positions_."""

    def _build_character_columns(self, line: str) -> dict[int, int]:
        """Responsibilities: _UTF-8 column map construction_."""
        columns = {0: 0}
        byte_column = 0
        for character_column, character in enumerate(line, 1):
            byte_column += len(character.encode())
            columns[byte_column] = character_column
        return columns

    def _valid_span(self, node: ast.AST) -> bool:
        """Responsibilities: _AST node span classification_."""
        if node.lineno is None or node.end_lineno is None:
            return False
        if node.col_offset is None or node.end_col_offset is None:
            return False
        if node.lineno <= 0:
            return False
        return node.end_lineno <= self.line_count()

    def _byte_segment(self, line: str, start: int, end: int) -> str:
        """Responsibilities: _UTF-8 source segment decoding_."""
        encoded_line = line.encode()
        segment = encoded_line[start:end]
        return segment.decode()

    def _multiple_line_segment(self, node: ast.AST, line: int, end_line: int) -> str:
        """Responsibilities: _multi-line AST source extraction_."""
        first_line = self.lines[line]
        last_line = self.lines[end_line]
        encoded_first_line = first_line.encode()
        first_bytes = encoded_first_line[node.col_offset :]
        first = first_bytes.decode()
        last = self._byte_segment(last_line, 0, node.end_col_offset)
        middle_lines = self.lines[line + 1 : end_line]
        middle = "".join(middle_lines)
        return first + middle + last

    def __init__(self, source: str) -> None:
        """Responsibilities: _initialization source text split_."""
        self.lines: Any = ast._splitlines_no_ff(source)
        self.character_columns: dict[str, dict[int, int]] = {}

    def line_count(self) -> int:
        """Responsibilities: _output number source lines_."""
        return len(self.lines)

    def line(self, line_number: int) -> str:
        """Responsibilities: _source line access_."""
        return self.lines[line_number - 1]

    def character_column(self, line: str, byte_column: int) -> int:
        """Responsibilities: _UTF-8 byte-column conversion_."""
        columns = self.character_columns.get(line)
        if columns is None:
            columns = self._build_character_columns(line)
            self.character_columns[line] = columns
        character_column = columns.get(byte_column)
        if character_column is not None:
            return character_column
        encoded_line = line.encode()
        prefix = encoded_line[:byte_column]
        return len(prefix.decode())

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
            return self._byte_segment(
                self.lines[line], node.col_offset, node.end_col_offset
            )
        return self._multiple_line_segment(node, line, end_line)
