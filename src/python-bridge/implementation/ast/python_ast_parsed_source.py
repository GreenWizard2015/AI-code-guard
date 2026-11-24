from __future__ import annotations

import ast


class PythonAstParsedSource:
    """Responsibilities: _source text_, _parsed module state_."""

    def __init__(self, source: str, syntax_tree: ast.Module, duration_ms: float) -> None:
        """Responsibilities: _parsed source state_."""
        self._source: str = source
        self._syntax_tree: ast.Module = syntax_tree
        self._duration_ms: float = duration_ms

    def source_code(self) -> str:
        """Responsibilities: _parsed source text_."""
        return self._source

    def duration_ms(self) -> float:
        """Responsibilities: _duration measurement_."""
        return self._duration_ms

    def failed(self) -> bool:
        """Responsibilities: _failure state flag_."""
        return False

    def syntax_tree(self) -> ast.Module:
        """Responsibilities: _parsed module access_."""
        return self._syntax_tree

    def issue_line(self) -> int:
        """Responsibilities: _error-state access_."""
        raise RuntimeError("A parsed source has no syntax issue line.")

    def issue_message(self) -> str:
        """Responsibilities: _error-state access_."""
        raise RuntimeError("A parsed source has no syntax issue message.")
