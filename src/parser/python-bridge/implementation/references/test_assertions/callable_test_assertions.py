from __future__ import annotations

import ast
from typing import Any

from implementation.ast.protocols import (
    PythonAstNodeIndexProtocol,
    PythonCallableStatementsProtocol,
)
from implementation.references.test_assertions.assertion_aliases import (
    PythonTestAssertionAliases,
)


class PythonCallableTestAssertions:
    """Responsibilities: _classification assertions exception assertions_."""

    def _is_unittest_assertion(self, statement: ast.stmt) -> bool:
        """Responsibilities: _identification assertion invocation statement_."""
        if type(statement) is not ast.Expr:
            return False
        expression: Any = statement.value
        if type(expression) is not ast.Call:
            return False
        return self.assertion_aliases.assertion_call(expression)

    def _is_true_assignment(self, node: ast.AST) -> bool:
        """Responsibilities: _identification assignments storage true_."""
        if type(node) is ast.Assign:
            if type(node.value) is not ast.Constant:
                return False
            return node.value.value is True
        if type(node) is ast.AnnAssign:
            if type(node.value) is not ast.Constant:
                return False
            return node.value.value is True
        return False

    def _exception_type_check(self, node: ast.AST) -> bool:
        """Responsibilities: _exception type check detection_."""
        if type(node) is not ast.Call:
            return False
        if type(node.func) is not ast.Name:
            return False
        return node.func.id == "isinstance"

    def _nested_assertion(self) -> bool:
        """Responsibilities: _classification callable contains nested_."""
        direct_ids = {
            id(statement.value)
            for statement in self.node.body
            if self._is_unittest_assertion(statement)
        }
        for item in self.node_index.nodes(self.node):
            if type(item) is not ast.Call:
                continue
            if not self.assertion_aliases.assertion_call(item):
                continue
            if id(item) not in direct_ids:
                return True
        return False

    def __init__(self, node: ast.AST, node_index: PythonAstNodeIndexProtocol) -> None:
        """Responsibilities: _initialization callable AST reusable_."""
        self.node: Any = node
        self.node_index: PythonAstNodeIndexProtocol = node_index
        self.assertion_aliases: PythonTestAssertionAliases = PythonTestAssertionAliases(
            node, node_index
        )

    def unittest_assertion_present(self) -> bool:
        """Responsibilities: _reporting callable contains unittest_."""
        return any(self._is_unittest_assertion(item) for item in self.node.body)

    def valid_assertion_ending(
        self, callable_statements: PythonCallableStatementsProtocol
    ) -> bool:
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

    def assertion_count(
        self, callable_statements: PythonCallableStatementsProtocol
    ) -> int:
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
        if not assertions:
            return False
        for item in assertions:
            if not self.assertion_aliases.exception_assertion(item):
                return False
        return True

    def exception_bypass(self) -> bool:
        """Responsibilities: _detection assertion bypasses hidden_."""
        for item in self.node_index.nodes(self.node):
            if type(item) is not ast.Try:
                continue
            if not item.handlers:
                continue
            for handler in item.handlers:
                handler_nodes = self.node_index.nodes(handler)
                for node in handler_nodes:
                    if self._exception_type_check(node):
                        return True
                if any(self._is_true_assignment(node) for node in handler_nodes):
                    return True
            return True
        return False
