from __future__ import annotations

import ast

from implementation.ast.protocols import (
    PythonAstNodeIndexContract,
    PythonCallableStatementsContract,
    PythonTestAssertionAliasesContract,
)
from implementation.rules.constants import PYTHON_ISINSTANCE_FUNCTION
from implementation.types import PythonCallableAstNode


class PythonCallableTestAssertions:
    """Responsibilities: _assertion ending validation_, _exception assertion analysis_."""

    def _is_unittest_assertion(self, statement: ast.stmt) -> bool:
        """Responsibilities: _identification assertion invocation statement_."""
        match statement:
            case ast.Expr(value=ast.Call() as expression):
                return self._assertion_aliases.assertion_call(expression)
            case _:
                return False

    def _is_true_assignment(self, node: ast.AST) -> bool:
        """Responsibilities: _identification assignments storage true_."""
        match node:
            case ast.Assign(value=ast.Constant(value=True)):
                return True
            case ast.AnnAssign(value=ast.Constant(value=True)):
                return True
            case _:
                return False

    def _exception_type_check(self, node: ast.AST) -> bool:
        """Responsibilities: _exception type check detection_."""
        match node:
            case ast.Call(func=ast.Name(id=name)) if name == PYTHON_ISINSTANCE_FUNCTION:
                return True
            case _:
                return False

    def _direct_assertion_ids(self) -> set[int]:
        """Responsibilities: _top-level assertion identities_."""
        direct_ids: set[int] = set()
        for statement in self._node.body:
            if self._is_unittest_assertion(statement):
                match statement:
                    case ast.Expr(value=ast.Call() as call):
                        direct_ids.add(id(call))
        return direct_ids

    def _is_nested_assertion(self, item: ast.AST, direct_ids: set[int]) -> bool:
        """Responsibilities: _nested assertion identity check_."""
        if type(item) is not ast.Call:
            return False
        if not self._assertion_aliases.assertion_call(item):
            return False
        return id(item) not in direct_ids

    def _try_bypasses_assertions(self, node: ast.Try) -> bool:
        """Responsibilities: _exception assertion bypass detection_."""
        for handler in node.handlers:
            handler_nodes = self._node_index.nodes(handler)
            if any(self._exception_type_check(item) for item in handler_nodes):
                return True
            if any(self._is_true_assignment(item) for item in handler_nodes):
                return True
        return True

    def _assertions_are_final(self, body: list[ast.stmt]) -> bool:
        """Responsibilities: _consecutive unittest assertions_."""
        found_assertion = False
        for statement in body:
            if self._is_unittest_assertion(statement):
                found_assertion = True
            else:
                if found_assertion:
                    return False
        return found_assertion

    def __init__(
        self,
        node: PythonCallableAstNode,
        node_index: PythonAstNodeIndexContract,
        assertion_aliases: PythonTestAssertionAliasesContract,
    ) -> None:
        """Responsibilities: _initialization callable AST reusable_."""
        self._node: PythonCallableAstNode = node
        self._node_index: PythonAstNodeIndexContract = node_index
        self._assertion_aliases: PythonTestAssertionAliasesContract = assertion_aliases

    def assertion_aliases(self) -> PythonTestAssertionAliasesContract:
        """Responsibilities: _assertion alias analysis access_."""
        return self._assertion_aliases

    def unittest_assertion_present(self) -> bool:
        """Responsibilities: _unittest assertion presence_."""
        return any(self._is_unittest_assertion(item) for item in self._node.body)

    def valid_assertion_ending(
        self,
        callable_statements: PythonCallableStatementsContract,
    ) -> bool:
        """Responsibilities: _validation test callable ends_."""
        body = callable_statements.body_without_docstring(self._node.body)
        if not self.unittest_assertion_present():
            return True
        direct_ids = self._direct_assertion_ids()
        if any(self._is_nested_assertion(item, direct_ids) for item in self._node_index.nodes(self._node)):
            return False
        return self._assertions_are_final(body)

    def assertion_count(
        self,
        callable_statements: PythonCallableStatementsContract,
    ) -> int:
        """Responsibilities: _callable unittest assertion count_."""
        body = callable_statements.body_without_docstring(self._node.body)
        count = 0
        for statement in body:
            if self._is_unittest_assertion(statement):
                count += 1
        return count

    def exception_only_assertion(self) -> bool:
        """Responsibilities: _reporting assertions exception assertions_."""
        assertions: list[ast.Call] = []
        for statement in self._node.body:
            if self._is_unittest_assertion(statement):
                match statement:
                    case ast.Expr(value=ast.Call() as call):
                        assertions.append(call)
        if not assertions:
            return False
        return all(self._assertion_aliases.exception_assertion(item) for item in assertions)

    def exception_bypass(self) -> bool:
        """Responsibilities: _detection assertion bypasses hidden_."""
        for item in self._node_index.nodes(self._node):
            match item:
                case ast.Try() as try_statement if try_statement.handlers:
                    if self._try_bypasses_assertions(try_statement):
                        return True
        return False
