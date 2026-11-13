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
        child_expression: ast.expr,
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
        traversal_expression: ast.expr,
        options: OperatorAppendOptions,
        root_expression: bool = True,
    ) -> PythonOperatorKinds:
        """Responsibilities: _collection operators expression_."""
        if self._expression_boundary.parenthesized(traversal_expression):
            if not root_expression:
                return set()
            if not options.root_parenthesized:
                return set()
        if options.boolean_group:
            return self._append_boolean_operators(traversal_expression, options)
        if type(traversal_expression) is not ast.BinOp:
            return set()
        return (
            {type(traversal_expression.op)}
            | self._append_operators(traversal_expression.left, options, root_expression=False)
            | self._append_operators(traversal_expression.right, options, root_expression=False)
        )

    def _append_boolean_operators(
        self,
        traversal_node: ast.expr,
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

    def _mixed(self, candidate_expression: ast.expr, boolean_group: bool) -> bool:
        """Responsibilities: _mixed operator precedence identification_."""
        if self._same_group_parent(candidate_expression, boolean_group):
            return False
        operators = self._append_operators(
            candidate_expression,
            OperatorAppendOptions(
                boolean_group,
                self._expression_boundary.parenthesized(candidate_expression),
            ),
        )
        if boolean_group:
            return self._mixed_boolean_operators(candidate_expression, operators)
        return len(operators) > 1

    def _mixed_boolean_operators(
        self,
        candidate_boolean: ast.expr,
        operators: PythonOperatorKinds,
    ) -> bool:
        """Responsibilities: _mixed boolean operator classification_."""
        if ast.Not not in operators:
            return len(operators) > 1
        if self._binary_operator_count(candidate_boolean) < 2:
            return False
        return len(operators) > 1

    def _binary_operator_count(self, boolean_expression: ast.expr) -> int:
        """Responsibilities: _binary operator count_."""
        if self._expression_boundary.parenthesized(boolean_expression):
            return 0
        if type(boolean_expression) is ast.BoolOp:
            return 1 + sum(self._binary_operator_count(value) for value in boolean_expression.values)
        if type(boolean_expression) is ast.UnaryOp:
            if type(boolean_expression.op) is ast.Not:
                return self._binary_operator_count(boolean_expression.operand)
        return 0

    def _mixed_boolean_issue(self, candidate: ast.expr) -> bool:
        """Responsibilities: _mixed boolean precedence classification_."""
        if self._expression_boundary.negation_comparison_boundary(candidate):
            return True
        if type(candidate) is not ast.BoolOp:
            return False
        if type(candidate.op) not in (ast.And, ast.Or):
            return False
        if self._same_group_parent(candidate, boolean_group=True):
            return False
        return self._mixed(candidate, boolean_group=True)

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

    def mixed_boolean_operator(self, expression: ast.expr) -> list[JsonObject]:
        """Responsibilities: _collection mixed boolean precedence_."""
        if self._mixed_boolean_issue(expression):
            return [{"line": expression.lineno - 1, "kind": PYTHON_MIXED_BOOLEAN_PRECEDENCE_KIND}]
        return []

    def mixed_arithmetic_operator(
        self,
        node: ast.expr,
    ) -> list[JsonObject]:
        """Responsibilities: _collection mixed arithmetic precedence_."""
        if self._arithmetic_operator(node):
            if self._mixed(node, boolean_group=False):
                return [
                    {
                        "line": node.lineno - 1,
                        "kind": "mixed-arithmetic-precedence",
                    },
                ]
        return []
