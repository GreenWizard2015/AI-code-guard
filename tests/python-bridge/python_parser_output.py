from __future__ import annotations

from implementation.types import JsonObject, JsonValueList


class PythonParserOutput:
    """Responsibilities: _parser result access_, _JSON shape assertions_."""

    def __init__(self, data: JsonObject) -> None:
        """Responsibilities: _parser record binding_."""
        self._data: JsonObject = data

    def text(self, name: str) -> str:
        """Responsibilities: _text metadata access_."""
        return self._data[name]

    def flag(self, name: str) -> bool:
        """Responsibilities: _boolean metadata access_."""
        return self._data[name]

    def line(self) -> int:
        """Responsibilities: _source line access_."""
        return self._data["line"]

    def start_line(self) -> int:
        """Responsibilities: _source span start line_."""
        return self._data["start_line"]

    def array(self, name: str) -> JsonValueList:
        """Responsibilities: _parser array access_."""
        return self._data[name]

    def records(self, name: str) -> list[PythonParserOutput]:
        """Responsibilities: _parser record collection access_."""
        return [PythonParserOutput(value) for value in self.array(name)]
