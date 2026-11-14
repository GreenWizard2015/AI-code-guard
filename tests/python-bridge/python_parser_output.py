from __future__ import annotations

import unittest

from implementation.types import JsonObject, JsonValue, JsonValueList


class PythonParserOutput:
    """Responsibilities: _parser result access_, _JSON shape assertions_."""

    def __init__(self, test_case: unittest.TestCase, data: JsonObject) -> None:
        """Responsibilities: _parser record binding_."""
        self._test_case: unittest.TestCase = test_case
        self._data: JsonObject = data

    def field(self, name: str) -> JsonValue:
        """Responsibilities: _parser field access_."""
        return self._data[name]

    def text(self, name: str) -> str:
        """Responsibilities: _text metadata access_."""
        value = self.field(name)
        if type(value) is not str:
            self._test_case.fail(f"expected text in {name}")
        return value

    def flag(self, name: str) -> bool:
        """Responsibilities: _boolean metadata access_."""
        value = self.field(name)
        if type(value) is not bool:
            self._test_case.fail(f"expected boolean in {name}")
        return value

    def array(self, name: str) -> JsonValueList:
        """Responsibilities: _parser array access_."""
        value = self.field(name)
        if type(value) is not list:
            self._test_case.fail(f"expected array in {name}")
        return value

    def records(self, name: str) -> list[PythonParserOutput]:
        """Responsibilities: _parser record collection access_."""
        records: list[PythonParserOutput] = []
        for value in self.array(name):
            if type(value) is not dict:
                self._test_case.fail(f"expected object in {name}")
            records.append(PythonParserOutput(self._test_case, value))
        return records
