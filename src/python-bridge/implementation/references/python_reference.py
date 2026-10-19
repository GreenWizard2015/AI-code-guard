from __future__ import annotations

import ast
from typing import Any

from implementation.references.protocols import PythonReferenceContextContract
from implementation.types import JsonObject
from implementation.rules.constants import PYTHON_FUNCTION_KIND


class PythonReference:
    """Responsibilities: _reference identity_, _expression metadata_."""

    def _function_reference(self, function: ast.Name, line: int) -> JsonObject:
        """Responsibilities: _construction normalization function reference_."""
        name: Any = function.id
        name = (
            self.context.reference_ownership().name_resolver().alias_target(function.id)
        )
        return {"name": name, "kind": PYTHON_FUNCTION_KIND, "line": line}

    def _method_reference(
        self,
        name: str,
        line: int,
        owner: str,
        caller_owner: str = "",
    ) -> JsonObject:
        """Responsibilities: _construction normalization method reference_."""
        reference: Any = {"name": name, "kind": "method", "line": line}
        if owner:
            reference["owner"] = owner
        else:
            reference["dynamic"] = True
        if caller_owner:
            reference["caller_owner"] = caller_owner
        return reference

    def _bound_reference(
        self, value: ast.AST, line: int, current_owner: str
    ) -> JsonObject:
        """Responsibilities: _construction normalization bound callable_."""
        if type(value) is ast.Name:
            return self._function_reference(value, line)
        if type(value) is not ast.Attribute:
            return {}
        owner: Any = self.context.attribute_owner(value.value, current_owner)
        return self._method_reference(value.attr, line, owner, current_owner)

    def _assignment_value(self, node: ast.AST) -> ast.AST:
        """Responsibilities: _extraction value expression assignment_."""
        if type(node) in (ast.Assign, ast.AnnAssign, ast.Return, ast.keyword):
            if node.value is not None:
                return node.value
        return ast.Constant(value=None)

    def __init__(self, context: PythonReferenceContextContract) -> None:
        """Responsibilities: _reference-resolution context initialization_."""
        self.context: Any = context

    def for_call(self, node: ast.Call, owner: str) -> JsonObject:
        """Responsibilities: _construction normalization reference invocation_."""
        function: Any = node.func
        line: Any = node.lineno - 1
        if type(function) is ast.Name:
            return self._function_reference(function, line)
        if type(function) is not ast.Attribute:
            return {}
        if function.attr == "bind":
            return self._bound_reference(function.value, line, owner)
        method_owner: Any = self.context.attribute_owner(function.value, owner)
        reference: Any = self._method_reference(
            function.attr, line, method_owner, owner
        )
        reference["is_call"] = True
        return reference

    def for_value(self, node: ast.AST, owner: str) -> JsonObject:
        """Responsibilities: _construction normalization reference callable_."""
        value: Any = self._assignment_value(node)
        if type(value) is ast.Constant and value.value is None:
            return {}
        return self.for_expression(value, node.lineno - 1, owner)

    def for_expression(self, value: ast.AST, line: int, owner: str) -> JsonObject:
        """Responsibilities: _construction normalization reference callable_."""
        if type(value) is ast.Name:
            return self._function_reference(value, line)
        if type(value) is ast.Attribute:
            method_owner: Any = self.context.attribute_owner(value.value, owner)
            return self._method_reference(value.attr, line, method_owner, owner)
        return {}
