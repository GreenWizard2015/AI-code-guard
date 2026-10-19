from __future__ import annotations

import ast

from implementation.protocols import PythonCallClassificationContract
from implementation.types import JsonObject
from implementation.rules.constants import (
    PYTHON_DATETIME_MODULE,
    PYTHON_NOW_ATTRIBUTE,
    PYTHON_TODAY_ATTRIBUTE,
)


class PythonTestTimeDependency:
    """Responsibilities: _time source recognition_, _test dependency reporting_."""

    def _time_call(self, node: ast.Call) -> bool:
        """Responsibilities: _time invocation identity_."""
        function = node.func
        if type(function) is not ast.Attribute:
            return False
        owner = function.value
        if type(owner) is not ast.Name:
            return False
        return (owner.id, function.attr) in self.time_names

    def __init__(self) -> None:
        """Responsibilities: _time dependency names_."""
        self.time_names: set[tuple[str, str]] = {
            ("time", "time"),
            ("time", "sleep"),
            ("random", "random"),
            (PYTHON_DATETIME_MODULE, PYTHON_NOW_ATTRIBUTE),
            (PYTHON_DATETIME_MODULE, PYTHON_TODAY_ATTRIBUTE),
            ("date", "today"),
        }

    def matches(self, node: ast.AST) -> bool:
        """Responsibilities: _test time dependency matching_."""
        if type(node) is not ast.Call:
            return False
        return self._time_call(node)

    def issue(
        self, node: ast.AST, classification: PythonCallClassificationContract
    ) -> list[JsonObject]:
        """Responsibilities: _test time violation creation_."""
        if not classification.test_function(node):
            return []
        if not self.matches(node):
            return []
        return [{"line": node.lineno - 1, "kind": "test-time-dependency"}]
