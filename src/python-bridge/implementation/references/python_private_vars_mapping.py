from __future__ import annotations

import ast
from collections.abc import Callable

from implementation.protocols import PythonReflectionNamesContract
from implementation.rules.constants import PYTHON_DICT_ATTRIBUTE

StringValue = Callable[[ast.AST], str]


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

    def _vars_arguments(self, node: ast.AST) -> list[ast.AST]:
        """Responsibilities: _vars arguments_."""
        if type(node) is not ast.Call:
            return []
        if self.reflection_names.access_name(node.func) != "vars":
            return []
        return node.args

    def _vars_method_arguments(self, function: ast.AST) -> list[ast.AST]:
        """Responsibilities: _vars method owner arguments_."""
        if type(function) is not ast.Attribute:
            return []
        return self._vars_arguments(function.value)

    def _supported_vars_method(self, function: ast.AST) -> bool:
        """Responsibilities: _vars method name classification_."""
        if type(function) is not ast.Attribute:
            return False
        return function.attr in {
            "get",
            "pop",
            "setdefault",
            "__getitem__",
            "__delitem__",
        }

    def _vars_method_member(self, node: ast.AST) -> str:
        """Responsibilities: _vars method member extraction_."""
        if type(node) is not ast.Call:
            return ""
        function = node.func
        if not self._supported_vars_method(function):
            return ""
        arguments = self._vars_method_arguments(function)
        if len(arguments) != 1:
            return ""
        if len(node.args) == 0:
            return ""
        return self.string_value(node.args[0])

    def _vars_method(self, node: ast.AST, members: set[str]) -> bool:
        """Responsibilities: _vars method access_."""
        member = self._vars_method_member(node)
        if member not in members:
            return False
        function = node.func
        arguments = self._vars_method_arguments(function)
        return not self._is_receiver(arguments[0])

    def _dictionary(self, node: ast.AST, members: set[str]) -> bool:
        """Responsibilities: _dictionary mapping access_."""
        if type(node) is not ast.Subscript:
            return False
        member = self.string_value(node.slice)
        if member not in members:
            return False
        return self._dictionary_owner(node.value)

    def _vars_mapping(self, node: ast.AST, members: set[str]) -> bool:
        """Responsibilities: _vars mapping access_."""
        if type(node) is not ast.Subscript:
            return False
        arguments = self._vars_arguments(node.value)
        if len(arguments) != 1:
            return False
        member = self.string_value(node.slice)
        if member not in members:
            return False
        return not self._is_receiver(arguments[0])

    def __init__(
        self,
        reflection_names: PythonReflectionNamesContract,
        string_value: StringValue,
    ) -> None:
        """Responsibilities: _initialization vars mapping state_."""
        self.reflection_names: PythonReflectionNamesContract = reflection_names
        self.string_value: StringValue = string_value

    def supports(self, node: ast.AST) -> bool:
        """Responsibilities: _private mapping form detection_."""
        if type(node) is ast.Subscript:
            return True
        if type(node) is ast.Call:
            return self._vars_method_member(node) != ""
        return False

    def access(self, node: ast.AST, members: set[str]) -> bool:
        """Responsibilities: _private mapping access_."""
        if not self.supports(node):
            return False
        if self._dictionary(node, members):
            return True
        if self._vars_mapping(node, members):
            return True
        return self._vars_method(node, members)
