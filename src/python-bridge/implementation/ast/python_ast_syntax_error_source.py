from __future__ import annotations

import ast


class PythonAstSyntaxErrorSource:
    """Responsibilities: _source text_, _syntax failure details_."""

    def __init__(self, source: str, error: SyntaxError, duration_ms: float) -> None:
        """Responsibilities: _syntax failure state_."""
        self._source: str = source
        self._error: SyntaxError = error
        self._duration_ms: float = duration_ms

    def source_code(self) -> str:
        """Responsibilities: _invalid source text_."""
        return self._source

    def duration_ms(self) -> float:
        """Responsibilities: _duration measurement_."""
        return self._duration_ms

    def failed(self) -> bool:
        """Responsibilities: _failure state flag_."""
        return True

    def syntax_tree(self) -> ast.Module:
        """Responsibilities: _success-state access_."""
        raise RuntimeError("A syntax error source has no parsed module.")

    def issue_line(self) -> int:
        """Responsibilities: _zero-based issue line_."""
        return max(0, (self._error.lineno or 1) - 1)

    def issue_message(self) -> str:
        """Responsibilities: _syntax issue message_."""
        return self._error.msg
