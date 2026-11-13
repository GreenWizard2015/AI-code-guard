from __future__ import annotations

import ast

from implementation.types import PythonCharacterColumnsByLine


class SourceSegments:
    """Responsibilities: _source span access_, _UTF-8 column mapping_."""

    def _segment_text(self, line: int, end_line: int, start_column: int, end_column: int) -> str:
        """Responsibilities: _UTF-8 AST span slicing_."""
        if end_line == line:
            line_bytes = self._lines[line].encode()
            return line_bytes[start_column:end_column].decode()
        first_bytes = self._lines[line].encode()
        last_bytes = self._lines[end_line].encode()
        first = first_bytes[start_column:].decode()
        last = last_bytes[:end_column].decode()
        segment_lines = self._lines[line + 1 : end_line]
        segment_lines.insert(0, first)
        segment_lines.append(last)
        return "".join(segment_lines)

    def _build_character_columns(self, source_line: str) -> dict[int, int]:
        """Responsibilities: _UTF-8 column map construction_."""
        columns = {0: 0}
        byte_column = 0
        for character_column, character in enumerate(source_line, 1):
            byte_column += len(character.encode())
            columns[byte_column] = character_column
        return columns

    def _ast_segment(self, node: ast.stmt) -> str:
        """Responsibilities: _AST source span extraction_."""
        position = node
        if position.end_lineno is None or position.end_col_offset is None:
            return ""
        return self._segment_text(
            position.lineno - 1,
            position.end_lineno - 1,
            position.col_offset,
            position.end_col_offset,
        )

    def __init__(self, source: str) -> None:
        """Responsibilities: _source segment state initialization_."""
        self._source: str = source
        self._lines: list[str] = source.splitlines(keepends=True)
        unsupported_line_breaks = (
            "\v",
            "\f",
            "\x1c",
            "\x1d",
            "\x1e",
            "\x85",
            "\u2028",
            "\u2029",
        )
        self._has_non_ast_line_break: bool = any(line.endswith(unsupported_line_breaks) for line in self._lines)
        self._character_columns: PythonCharacterColumnsByLine = {}

    def line(self, line_number: int) -> str:
        """Responsibilities: _source line access_."""
        return self._lines[line_number - 1]

    def character_column(self, line_text: str, byte_column: int) -> int:
        """Responsibilities: _UTF-8 byte-column conversion_."""
        columns = self._character_columns.get(line_text)
        if columns is None:
            columns = self._build_character_columns(line_text)
            self._character_columns.update({line_text: columns})
        character_column = columns.get(byte_column)
        if character_column is not None:
            return character_column
        encoded_line = line_text.encode()
        prefix = encoded_line[:byte_column]
        return len(prefix.decode())

    def significant_characters(self, text: str) -> int:
        """Responsibilities: _source non-whitespace character count_."""
        return len("".join(text.split()))

    def segment(self, node: ast.stmt) -> str:
        """Responsibilities: _AST source segment extraction_."""
        try:
            if self._has_non_ast_line_break:
                source_segment = ast.get_source_segment(self._source, node)
                if source_segment is None:
                    return ""
                return source_segment
            return self._ast_segment(node)
        except IndexError:
            return ""
        except AttributeError:
            return ""
