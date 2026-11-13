from __future__ import annotations

import ast

from implementation.ast.protocols import PythonCallableConditionContextContract
from implementation.references.protocols import PythonReferenceAliasesContract
from implementation.rules.constants import (
    PYTHON_DATETIME_MODULE,
    PYTHON_NOW_ATTRIBUTE,
    PYTHON_TODAY_ATTRIBUTE,
)
from implementation.types import JsonObject, PythonTimeName


class PythonTestTimeDependency:
    """Responsibilities: _time source recognition_, _test dependency reporting_."""

    def __init__(self, reference_aliases: PythonReferenceAliasesContract) -> None:
        """Responsibilities: _time dependency names_."""
        self._reference_aliases: PythonReferenceAliasesContract = reference_aliases
        self._time_names: frozenset[PythonTimeName] = frozenset(
            {
                PythonTimeName("time", "time"),
                PythonTimeName("time", "sleep"),
                PythonTimeName("random", "random"),
                PythonTimeName(PYTHON_DATETIME_MODULE, PYTHON_NOW_ATTRIBUTE),
                PythonTimeName(PYTHON_DATETIME_MODULE, PYTHON_TODAY_ATTRIBUTE),
                PythonTimeName("date", "today"),
            },
        )
        self._time_modules: frozenset[str] = frozenset(time_name.module for time_name in self._time_names)

    def time_call(self, function: ast.expr) -> bool:
        """Responsibilities: _time invocation identity_."""
        if type(function) is not ast.Attribute:
            return False
        owner = function.value
        if type(owner) is not ast.Name:
            return False
        if PythonTimeName(owner.id, function.attr) in self._time_names:
            return True
        resolved_owner = self._reference_aliases.resolved_name(
            owner.id,
            self._time_modules,
        )
        return PythonTimeName(resolved_owner, function.attr) in self._time_names

    def issue(
        self,
        node: ast.Call,
        classification: PythonCallableConditionContextContract,
    ) -> list[JsonObject]:
        """Responsibilities: _test time violation creation_."""
        if not classification.test_function(node):
            return []
        if not self.time_call(node.func):
            return []
        return [{"line": node.lineno - 1, "kind": "test-time-dependency"}]
