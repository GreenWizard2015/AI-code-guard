from __future__ import annotations

import ast
from typing import cast

from implementation.references.constants import (
    PYTHON_CALL_USE_KEY,
    PYTHON_CALLER_OWNER_KEY,
)
from implementation.references.protocols import (
    PythonCallReferenceOptionsContract,
    PythonReferenceContextContract,
)
from implementation.references.python_receiver_expression import (
    PythonReceiverExpression,
)
from implementation.rules.constants import PYTHON_FUNCTION_KIND
from implementation.types import JsonObject, PythonASTLocatedNode


class PythonReference:
    """Responsibilities: _reference identity_, _expression metadata_."""

    def _function_reference(
        self,
        function: ast.Name,
        function_site: ast.AST,
    ) -> JsonObject:
        """Responsibilities: _construction normalization function reference_."""
        name = self._context.name_resolver().alias_target(function.id)
        return {
            "name": name,
            "kind": PYTHON_FUNCTION_KIND,
            "owner": "",
            PYTHON_CALLER_OWNER_KEY: "",
            "target_file": "",
            "is_call": False,
            "dynamic": False,
            "line": cast(PythonASTLocatedNode, function_site).lineno - 1,
            "call_use": self._call_use(),
        }

    def _method_reference(
        self,
        name: str,
        method_site: ast.AST,
        receiver_owner: str,
        caller_owner: str = "",
    ) -> JsonObject:
        """Responsibilities: _construction normalization method reference_."""
        return {
            "name": name,
            "kind": "method",
            "owner": receiver_owner,
            PYTHON_CALLER_OWNER_KEY: caller_owner,
            "target_file": "",
            "is_call": False,
            "dynamic": not receiver_owner,
            "line": cast(PythonASTLocatedNode, method_site).lineno - 1,
            "call_use": self._call_use(),
        }

    def _call_use(self) -> JsonObject:
        """Responsibilities: _empty call-site metadata_."""
        return {
            "assigned_name": "",
            "assigned_type_name": "",
            "callee_name": "",
            "receiver_name": "",
            "receiver_constructor_name": "",
            "deferred": False,
        }

    def _bound_reference(
        self,
        value: ast.AST,
        call_node: ast.AST,
        current_owner: str,
    ) -> JsonObject:
        """Responsibilities: _construction normalization bound callable_."""
        match value:
            case ast.Name():
                return self._function_reference(value, call_node)
            case ast.Attribute(value=receiver, attr=name):
                owner = self._context.attribute_owner(receiver, current_owner)
                return self._method_reference(name, call_node, owner, current_owner)
            case _:
                return {}

    def _expression_reference(
        self,
        expression: ast.AST,
        expression_site: ast.AST,
        caller_owner: str,
    ) -> JsonObject:
        """Responsibilities: _expression callable reference construction_."""
        match expression:
            case ast.Name():
                return self._function_reference(expression, expression_site)
            case ast.Attribute(value=receiver, attr=name):
                method_owner = self._context.attribute_owner(receiver, caller_owner)
                return self._method_reference(
                    name,
                    expression_site,
                    method_owner,
                    caller_owner,
                )
            case _:
                return {}

    def _assignment_value(self, node: ast.AST) -> ast.AST:
        """Responsibilities: _extraction value expression assignment_."""
        match node:
            case ast.Assign(value=value):
                pass
            case ast.AnnAssign(value=value):
                pass
            case ast.Return(value=value):
                pass
            case ast.keyword(value=value):
                pass
            case _:
                return ast.Constant(value=None)
        if value is None:
            return ast.Constant(value=None)
        return value

    def _function_call(
        self,
        function_options: PythonCallReferenceOptionsContract,
    ) -> JsonObject:
        """Responsibilities: _function reference creation_."""
        node = function_options.call_node()
        function = node.func
        match function:
            case ast.Name():
                pass
            case _:
                return {}
        binding = function_options.binding()
        reference = self._function_reference(function, node)
        owner = function_options.caller_owner()
        if owner:
            reference[PYTHON_CALLER_OWNER_KEY] = owner
        reference["is_call"] = True
        reference[PYTHON_CALL_USE_KEY] = binding.function_use(function.id)
        return reference

    def _method_call(
        self,
        method_options: PythonCallReferenceOptionsContract,
    ) -> JsonObject:
        """Responsibilities: _method call resolution_."""
        node = method_options.call_node()
        match node.func:
            case ast.Attribute(value=receiver, attr=name):
                pass
            case _:
                return {}
        if name == "bind":
            return self._bound_reference(receiver, node, method_options.caller_owner())
        return self._invoked_method_reference(method_options, receiver, name)

    def _invoked_method_reference(
        self,
        options: PythonCallReferenceOptionsContract,
        receiver: ast.AST,
        name: str,
    ) -> JsonObject:
        """Responsibilities: _invoked method reference metadata_."""
        node = options.call_node()
        owner = options.caller_owner()
        binding = options.binding()
        method_owner = self._context.attribute_owner(receiver, owner)
        reference = self._method_reference(name, node, method_owner, owner)
        reference["is_call"] = True
        receiver_expression = PythonReceiverExpression(receiver)
        reference[PYTHON_CALL_USE_KEY] = binding.method_use(
            receiver_expression.variable_name(),
            receiver_expression.constructor_name(),
        )
        return reference

    def __init__(self, context: PythonReferenceContextContract) -> None:
        """Responsibilities: _reference-resolution context initialization_."""
        self._context: PythonReferenceContextContract = context

    def for_call(self, options: PythonCallReferenceOptionsContract) -> JsonObject:
        """Responsibilities: _construction normalization reference invocation_."""
        node = options.call_node()
        function = node.func
        match function:
            case ast.Name():
                return self._function_call(options)
            case ast.Attribute():
                return self._method_call(options)
            case _:
                return {}

    def for_value(self, node: ast.AST, owner: str) -> JsonObject:
        """Responsibilities: _construction normalization reference callable_."""
        value = self._assignment_value(node)
        match value:
            case ast.Constant(value=None):
                return {}
        return self._expression_reference(value, node, owner)

    def for_expression(self, value: ast.AST, owner: str) -> JsonObject:
        """Responsibilities: _construction normalization reference callable_."""
        return self._expression_reference(value, value, owner)
