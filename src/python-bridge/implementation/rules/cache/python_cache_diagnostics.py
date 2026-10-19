from implementation.rules.protocols import PythonCacheDiagnosticsContract
from implementation.types import JsonObject


class PythonCacheDiagnostics(PythonCacheDiagnosticsContract):
    """Responsibilities: _diagnostic ownership_, _duplicate suppression_."""

    _issues: list[JsonObject]
    _emitted: set[int]

    def __init__(self) -> None:
        """Responsibilities: _cache diagnostic state initialization_."""
        self._issues: list[JsonObject] = []
        self._emitted: set[int] = set()

    def clear(self) -> None:
        """Responsibilities: _analysis lifecycle reset_."""
        self._issues.clear()
        self._emitted.clear()

    def append(self, line: int) -> None:
        """Responsibilities: _unique cache diagnostic recording_."""
        if line in self._emitted:
            return
        self._issues.append({"line": line, "kind": "incomplete-cache-key", "name": ""})
        self._emitted.add(line)

    def values(self) -> list[JsonObject]:
        """Responsibilities: _cache diagnostic results_."""
        return list(self._issues)
