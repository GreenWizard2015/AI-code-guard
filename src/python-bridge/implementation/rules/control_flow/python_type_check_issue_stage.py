from __future__ import annotations

import ast

from implementation.ast.protocols import PythonAstNodeIndexContract
from implementation.rules.constants import (
    PYTHON_TEST_TYPE_CHECK_FUNCTIONS,
    PYTHON_TEST_TYPE_CHECK_RULE,
    PYTHON_TYPE_FUNCTION,
)
from implementation.rules.control_flow.protocols import PythonAstExpressionSelectionContract
from implementation.types import JsonObject


class PythonTypeCheckIssueStage:
    """Responsibilities: _Python runtime type probes_, _type matcher recognition_."""

    _type_check_functions: frozenset[str]
    _node_index: PythonAstNodeIndexContract
    _expression_selection: PythonAstExpressionSelectionContract

    def _call_name(self, function: ast.expr) -> str:
        """Responsibilities: _type probe name resolution_."""
        if type(function) is ast.Name:
            return function.id
        if type(function) is ast.Attribute:
            return function.attr
        return ""

    def _type_probe_call(self, node: ast.Call) -> bool:
        """Responsibilities: _runtime type probe calls_."""
        name = self._call_name(node.func)
        if name in self._type_check_functions:
            return True
        if name != PYTHON_TYPE_FUNCTION:
            return False
        return len(node.args) == 1

    def _type_comparison(self, node: ast.Compare) -> bool:
        """Responsibilities: _runtime type comparisons_."""
        left = node.left
        if type(left) is not ast.Call:
            return False
        if type(left.func) is not ast.Name:
            return False
        if left.func.id != PYTHON_TYPE_FUNCTION:
            return False
        return len(left.args) == 1

    def _expression_lines(self, statement: ast.stmt) -> set[int]:
        """Responsibilities: _type-check source location collection_."""
        return {
            expression.lineno - 1
            for expression in self._expression_selection.expressions(statement)
            if self.type_check_expression(expression)
        }

    def __init__(
        self,
        node_index: PythonAstNodeIndexContract,
        expression_selection: PythonAstExpressionSelectionContract,
    ) -> None:
        """Responsibilities: _type probe vocabulary_."""
        self._type_check_functions = PYTHON_TEST_TYPE_CHECK_FUNCTIONS
        self._node_index = node_index
        self._expression_selection = expression_selection

    def type_check_expression(self, candidate_node: ast.AST) -> bool:
        """Responsibilities: _runtime type probe classification_."""
        if type(candidate_node) is ast.MatchClass:
            return True
        if type(candidate_node) is ast.Call:
            return self._type_probe_call(candidate_node)
        if type(candidate_node) is ast.Attribute:
            return candidate_node.attr == "__class__"
        if type(candidate_node) is ast.Compare:
            return self._type_comparison(candidate_node)
        return False

    def type_check_issues(self, function_statements: list[ast.stmt]) -> list[JsonObject]:
        """Responsibilities: _runtime type check findings_."""
        lines: set[int] = set()
        for statement in function_statements:
            lines.update(self._expression_lines(statement))
            for node in self._node_index.nodes(statement):
                match node:
                    case ast.MatchClass(lineno=line):
                        lines.add(line - 1)
        return [{"line": line, "kind": PYTHON_TEST_TYPE_CHECK_RULE} for line in sorted(lines)]
