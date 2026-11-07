from __future__ import annotations

import ast
from collections.abc import Sequence
from collections.abc import Set as AbstractSet

from implementation.protocols import PythonReflectionNamesContract
from implementation.references.alias_types import CallablePythonStringValue
from implementation.rules.constants import (
    PRIVATE_ACCESS_CALLS,
    PYTHON_DICT_ATTRIBUTE,
    PYTHON_SETDEFAULT_METHOD,
)


class PythonPrivateVarsMapping:
    """Responsibilities: _mapping access classification_, _private member resolution_."""

    def _is_receiver(self, value: ast.AST) -> bool:
        """Responsibilities: _receiver identity_."""
        if type(value) is not ast.Name:
            return False
        return value.id in {"self", "cls"}

    def _dictionary_owner(self, value: ast.AST) -> bool:
        """Responsibilities: _dictionary owner classification_."""
        if type(value) is not ast.Attribute:
            return False
        if value.attr != PYTHON_DICT_ATTRIBUTE:
            return False
        if type(value.value) is not ast.Name:
            return True
        return not self._is_receiver(value.value)

    def _vars_arguments(self, vars_expression: ast.AST) -> list[ast.expr]:
        """Responsibilities: _vars arguments_."""
        match vars_expression:
            case ast.Call() as call:
                pass
            case _:
                return []
        if self._reflection_names.resolve(call.func, PRIVATE_ACCESS_CALLS) != "vars":
            return []
        return call.args

    def _vars_method_arguments(self, function: ast.AST) -> list[ast.expr]:
        """Responsibilities: _vars method owner arguments_."""
        match function:
            case ast.Attribute(value=receiver):
                return self._vars_arguments(receiver)
            case _:
                return []

    def _supported_vars_method(self, function: ast.AST) -> bool:
        """Responsibilities: _vars method name classification_."""
        if type(function) is not ast.Attribute:
            return False
        return function.attr in {
            "get",
            "pop",
            PYTHON_SETDEFAULT_METHOD,
            "__getitem__",
            "__delitem__",
        }

    def _vars_method_member(self, mapping_method_call: ast.Call) -> str:
        """Responsibilities: _vars method member extraction_."""
        function = mapping_method_call.func
        if not self._supported_vars_method(function):
            return ""
        arguments = self._vars_method_arguments(function)
        if len(arguments) != 1:
            return ""
        if len(mapping_method_call.args) == 0:
            return ""
        return self._string_value(mapping_method_call.args[0])

    def _private_access(self, access_expression: ast.AST) -> bool:
        """Responsibilities: _private mapping ownership_."""
        if type(access_expression) is ast.Subscript:
            if self._dictionary_owner(access_expression.value):
                return True
            arguments = self._vars_arguments(access_expression.value)
            return self._non_receiver_argument(arguments)
        if type(access_expression) is ast.Call:
            arguments = self._vars_method_arguments(access_expression.func)
            return self._non_receiver_argument(arguments)
        return False

    def _non_receiver_argument(self, arguments: Sequence[ast.AST]) -> bool:
        """Responsibilities: _vars argument ownership classification_."""
        if len(arguments) != 1:
            return False
        return not self._is_receiver(arguments[0])

    def __init__(
        self,
        reflection_names: PythonReflectionNamesContract,
        string_value: CallablePythonStringValue,
    ) -> None:
        """Responsibilities: _initialization vars mapping state_."""
        self._reflection_names: PythonReflectionNamesContract = reflection_names
        self._string_value: CallablePythonStringValue = string_value

    def supports(self, candidate_expression: ast.AST) -> bool:
        """Responsibilities: _private mapping form detection_."""
        if type(candidate_expression) is ast.Subscript:
            return True
        if type(candidate_expression) is ast.Call:
            return self._vars_method_member(candidate_expression) != ""
        return False

    def access(self, access_expression: ast.AST, members: AbstractSet[str]) -> bool:
        """Responsibilities: _private mapping access_."""
        if type(access_expression) is ast.Subscript:
            member = self._string_value(access_expression.slice)
            if member not in members:
                return False
            return self._private_access(access_expression)
        if type(access_expression) is ast.Call:
            member = self._vars_method_member(access_expression)
            if member not in members:
                return False
            return self._private_access(access_expression)
        return False
