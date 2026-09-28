from __future__ import annotations

from implementation.types import JsonObject


class PythonAstTimedResult:
    """Responsibilities: _timed AST result values_."""

    def __init__(
        self,
        ast_value: JsonObject,
        parse_ms: float,
        build_ms: float,
        stages: dict[str, float],
    ) -> None:
        """Responsibilities: _timed AST result initialization_."""
        self._ast: JsonObject = ast_value
        self._parse_ms: float = parse_ms
        self._build_ms: float = build_ms
        self._stages: dict[str, float] = dict(stages)

    def ast_data(self) -> JsonObject:
        """Responsibilities: _AST result data access_."""
        return self._ast

    def syntax_duration(self) -> float:
        """Responsibilities: _AST syntax duration access_."""
        return self._parse_ms

    def normalization_duration(self) -> float:
        """Responsibilities: _AST normalization duration access_."""
        return self._build_ms

    def stage_times(self) -> dict[str, float]:
        """Responsibilities: _AST stage time access_."""
        return dict(self._stages)
