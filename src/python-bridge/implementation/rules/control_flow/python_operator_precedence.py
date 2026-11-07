from __future__ import annotations

import ast
from dataclasses import dataclass

from implementation.ast.protocols import PythonAstNodeIndexContract
from implementation.rules.constants import PYTHON_MIXED_BOOLEAN_PRECEDENCE_KIND
from implementation.rules.protocols import PythonExpressionBoundaryContract
from implementation.types import JsonObject, PythonOperatorKinds


@dataclass(frozen=True)
class OperatorAppendOptions:
    """Responsibilities: _operator family_, _parenthesized root boundary_."""

    boolean_group: bool
    root_parenthesized: bool


class PythonOperatorPrecedence:
    """Responsibilities: _boolean operator grouping_, _arithmetic operator grouping_."""

    def _arithmetic_operator(self, candidate: ast.AST) -> bool:
        """Responsibilities: _arithmetic operators identification_."""
        if type(candidate) is not ast.BinOp:
            return False
        return type(candidate.op) in (
            ast.Add,
            ast.Sub,
            ast.Mult,
            ast.Div,
            ast.FloorDiv,
            ast.Mod,
            ast.Pow,
        )

    def _same_group_parent(
        self,
        child_expression: ast.AST,
        boolean_group: bool,
    ) -> bool:
        """Responsibilities: _same-group parent operators identification_."""
        parents = self._node_index.parents(child_expression)
        parent = ast.AST()
        if parents:
            parent = parents[0]
        if self._expression_boundary.parenthesized(child_expression):
            return False
        if boolean_group:
            if type(parent) is not ast.BoolOp:
                return False
            return type(parent.op) in (ast.And, ast.Or)
        return self._arithmetic_operator(parent)

    def _append_operators(
        self,
        expression: ast.AST,
        options: OperatorAppendOptions,
        root_expression: bool = True,
    ) -> PythonOperatorKinds:
        """Responsibilities: _collection operators expression_."""
        if self._expression_boundary.parenthesized(expression):
            if not root_expression:
                return set()
            if not options.root_parenthesized:
                return set()
        if options.boolean_group:
            return self._append_boolean_operators(expression, options)
        if type(expression) is not ast.BinOp:
            return set()
        return (
            {type(expression.op)}
            | self._append_operators(expression.left, options, root_expression=False)
            | self._append_operators(expression.right, options, root_expression=False)
        )

    def _append_boolean_operators(
        self,
        traversal_node: ast.AST,
        boolean_options: OperatorAppendOptions,
        root_expression: bool = True,
    ) -> PythonOperatorKinds:
        """Responsibilities: _boolean operator traversal_."""
        if self._expression_boundary.parenthesized(traversal_node):
            if not root_expression or not boolean_options.root_parenthesized:
                return set()
        if type(traversal_node) is ast.BoolOp:
            operators: PythonOperatorKinds = {type(traversal_node.op)}
            for value in traversal_node.values:
                operators.update(
                    self._append_boolean_operators(value, boolean_options, root_expression=False),
                )
            return operators
        if type(traversal_node) is ast.UnaryOp and type(traversal_node.op) is ast.Not:
            return {type(traversal_node.op)} | self._append_boolean_operators(
                traversal_node.operand,
                boolean_options,
                root_expression=False,
            )
        return set()

    def _mixed(self, expression: ast.AST, boolean_group: bool) -> bool:
        """Responsibilities: _mixed operator precedence identification_."""
        if self._same_group_parent(expression, boolean_group):
            return False
        operators = self._append_operators(
            expression,
            OperatorAppendOptions(
                boolean_group,
                self._expression_boundary.parenthesized(expression),
            ),
        )
        if boolean_group:
            return self._mixed_boolean_operators(expression, operators)
        return len(operators) > 1

    def _mixed_boolean_operators(
        self,
        boolean_expression: ast.AST,
        operators: PythonOperatorKinds,
    ) -> bool:
        """Responsibilities: _mixed boolean operator classification_."""
        if ast.Not not in operators:
            return len(operators) > 1
        if self._binary_operator_count(boolean_expression) < 2:
            return False
        return len(operators) > 1

    def _binary_operator_count(self, boolean_expression: ast.AST) -> int:
        """Responsibilities: _binary operator count_."""
        if self._expression_boundary.parenthesized(boolean_expression):
            return 0
        if type(boolean_expression) is ast.BoolOp:
            return 1 + sum(self._binary_operator_count(value) for value in boolean_expression.values)
        if type(boolean_expression) is ast.UnaryOp:
            if type(boolean_expression.op) is ast.Not:
                return self._binary_operator_count(boolean_expression.operand)
        return 0

    def __init__(
        self,
        tree: ast.AST,
        node_index: PythonAstNodeIndexContract,
        expression_boundary: PythonExpressionBoundaryContract,
    ) -> None:
        """Responsibilities: _operator precedence analysis initialization_."""
        self._tree: ast.AST = tree
        self._expression_boundary: PythonExpressionBoundaryContract = expression_boundary
        self._node_index: PythonAstNodeIndexContract = node_index

    def mixed_boolean_operator(self, expression_candidate: ast.AST) -> list[JsonObject]:
        """Responsibilities: _collection mixed boolean precedence_."""
        line: int = expression_candidate.lineno - 1
        kind: str = PYTHON_MIXED_BOOLEAN_PRECEDENCE_KIND
        violation: JsonObject = {"line": line, "kind": kind}
        if self._expression_boundary.negation_comparison_boundary(expression_candidate):
            return [violation]
        if type(expression_candidate) is not ast.BoolOp:
            return []
        if type(expression_candidate.op) not in (ast.And, ast.Or):
            return []
        if self._same_group_parent(expression_candidate, boolean_group=True):
            return []
        if self._mixed(expression_candidate, boolean_group=True):
            return [violation]
        return []

    def mixed_arithmetic_operator(
        self,
        expression_candidate: ast.AST,
    ) -> list[JsonObject]:
        """Responsibilities: _collection mixed arithmetic precedence_."""
        if self._arithmetic_operator(expression_candidate):
            if self._mixed(expression_candidate, boolean_group=False):
                return [
                    {
                        "line": expression_candidate.lineno - 1,
                        "kind": "mixed-arithmetic-precedence",
                    },
                ]
        return []
