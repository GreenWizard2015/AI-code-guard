from __future__ import annotations

import ast
from typing import Any

from implementation.ast.callable_statements import CallableStatements
from implementation.ast.protocols import PythonAstNodeIndexProtocol


class PythonCallableTestAssertions:
    """Responsibilities: _classification assertions exception assertions_."""

    def _is_assertion_call(self, node: ast.Call) -> bool:
        """Responsibilities: _identification unittest assertion method_."""
        function: Any = node.func
        if type(function) is not ast.Attribute:
            return False
        assertion_name: Any = function.attr
        if not assertion_name.startswith("assert"):
            return False
        receiver: Any = function.value
        if type(receiver) is not ast.Name:
            return False
        return receiver.id == "self"

    def _is_exception_assertion(self, node: ast.Call) -> bool:
        """Responsibilities: _identification assertions expect exceptions_."""
        if not self._is_assertion_call(node):
            return False
        function: Any = node.func
        return function.attr.startswith("assertRaises")

    def _is_unittest_assertion(self, statement: ast.stmt) -> bool:
        """Responsibilities: _identification assertion invocation statement_."""
        if type(statement) is not ast.Expr:
            return False
        expression: Any = statement.value
        if type(expression) is not ast.Call:
            return False
        return self._is_assertion_call(expression)

    def _is_true_assignment(self, node: ast.AST) -> bool:
        """Responsibilities: _identification assignments storage true_."""
        if type(node) is ast.Assign:
            return type(node.value) is ast.Constant and node.value.value is True
        if type(node) is ast.AnnAssign:
            return type(node.value) is ast.Constant and node.value.value is True
        return False

    def _nested_assertion(self) -> bool:
        """Responsibilities: _classification callable contains nested_."""
        direct_ids = {
            id(statement.value)
            for statement in self.node.body
            if self._is_unittest_assertion(statement)
        }
        return any(
            type(item) is ast.Call
            and self._is_assertion_call(item)
            and id(item) not in direct_ids
            for item in self.node_index.nodes(self.node)
        )

    def __init__(self, node: ast.AST, node_index: PythonAstNodeIndexProtocol) -> None:
        """Responsibilities: _initialization callable AST reusable_."""
        self.node: Any = node
        self.node_index: PythonAstNodeIndexProtocol = node_index

    def unittest_assertion_present(self) -> bool:
        """Responsibilities: _reporting callable contains unittest_."""
        return any(self._is_unittest_assertion(item) for item in self.node.body)

    def valid_assertion_ending(self, callable_statements: CallableStatements) -> bool:
        """Responsibilities: _validation test callable ends_."""
        body: Any = callable_statements.body_without_docstring(self.node.body)
        if not self.unittest_assertion_present():
            return True
        if self._nested_assertion():
            return False
        found_assertion: Any = False
        for statement in body:
            if not found_assertion:
                if self._is_unittest_assertion(statement):
                    found_assertion: Any = True
                continue
            if not self._is_unittest_assertion(statement):
                return False
        return found_assertion

    def assertion_count(self, callable_statements: CallableStatements) -> int:
        """Responsibilities: _callable unittest assertion count_."""
        body: Any = callable_statements.body_without_docstring(self.node.body)
        count: Any = 0
        for statement in body:
            if self._is_unittest_assertion(statement):
                count += 1
        return count

    def exception_only_assertion(self) -> bool:
        """Responsibilities: _reporting assertions exception assertions_."""
        assertions = [
            statement.value
            for statement in self.node.body
            if self._is_unittest_assertion(statement)
        ]
        return bool(assertions) and all(
            self._is_exception_assertion(item) for item in assertions
        )

    def exception_bypass(self) -> bool:
        """Responsibilities: _detection assertion bypasses hidden_."""
        for item in self.node_index.nodes(self.node):
            if type(item) is not ast.Try or not item.handlers:
                continue
            for handler in item.handlers:
                handler_nodes = self.node_index.nodes(handler)
                if any(
                    type(node) is ast.Call
                    and type(node.func) is ast.Name
                    and node.func.id == "isinstance"
                    for node in handler_nodes
                ):
                    return True
                if any(self._is_true_assignment(node) for node in handler_nodes):
                    return True
            return True
        return False
