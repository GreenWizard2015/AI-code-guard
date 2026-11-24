from __future__ import annotations

from implementation.json_value_view import JsonValueView
from implementation.types import JsonObject, JsonValueList


class PythonParserOutput:
    """Responsibilities: _parser result access_, _typed JSON projections_."""

    def __init__(self, data: JsonObject) -> None:
        """Responsibilities: _parser record binding_."""
        self._data: JsonObject = data
        self._reader: JsonValueView = JsonValueView()

    def text(self, name: str) -> str:
        """Responsibilities: _text metadata access_."""
        self._reader.read(self._data[name])
        return self._reader.text()

    def flag(self, name: str) -> bool:
        """Responsibilities: _boolean metadata access_."""
        self._reader.read(self._data[name])
        return self._reader.boolean()

    def line(self) -> int:
        """Responsibilities: _source line access_."""
        self._reader.read(self._data["line"])
        return self._reader.integer()

    def start_line(self) -> int:
        """Responsibilities: _source span start line_."""
        self._reader.read(self._data["start_line"])
        return self._reader.integer()

    def array(self, name: str) -> JsonValueList:
        """Responsibilities: _parser array access_."""
        self._reader.read(self._data[name])
        return self._reader.array()

    def records(self, name: str) -> list[PythonParserOutput]:
        """Responsibilities: _parser record collection access_."""
        records: list[PythonParserOutput] = []
        for value in self.array(name):
            self._reader.read(value)
            records.append(PythonParserOutput(self._reader.object()))
        return records
