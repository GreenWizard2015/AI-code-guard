from __future__ import annotations


from implementation.ast.protocols import PythonAstTimedResultProtocol
from implementation.types import JsonObject, JsonValue


class PythonBatchResult:
    """Responsibilities: _Python batch timing_."""

    def _timing_payload(self) -> JsonObject:
        """Responsibilities: _batch timing serialization_."""
        ast_parse_ms = 0.0
        ast_build_ms = 0.0
        ast_stages: dict[str, float] = {}
        for timed_result in self.results.values():
            ast_parse_ms += timed_result.syntax_duration()
            ast_build_ms += timed_result.normalization_duration()
            for stage_name, stage_ms in timed_result.stage_times().items():
                ast_stages[stage_name] = ast_stages.get(stage_name, 0.0) + stage_ms
        return {
            "ast_parse_ms": ast_parse_ms,
            "ast_build_ms": ast_build_ms,
            "ast_stages": [
                {"name": name, "duration_ms": duration}
                for name, duration in ast_stages.items()
            ],
        }

    def __init__(self, batch_id: str) -> None:
        """Responsibilities: _initialization batch response_."""
        self.batch_id: str = batch_id
        self.results: dict[str, PythonAstTimedResultProtocol] = {}

    def add(self, name: str, timed_result: PythonAstTimedResultProtocol) -> None:
        """Responsibilities: _batch AST timing entry_."""
        self.results[name] = timed_result

    def result(self) -> JsonObject:
        """Responsibilities: _batch response serialization_."""
        asts: dict[str, JsonValue] = {
            name: timed_result.ast_data()
            for name, timed_result in self.results.items()
        }
        return {
            "batchId": self.batch_id,
            "asts": asts,
            "timings": self._timing_payload(),
        }
