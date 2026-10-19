from __future__ import annotations

import ast
from implementation.rules.constants import PYTHON_MIXED_BOOLEAN_PRECEDENCE_KIND
from dataclasses import dataclass
from typing import Any

from implementation.protocols import (
    PythonAstNodeIndexContract,
    PythonExpressionBoundaryContract,
)
from implementation.types import JsonObject, OperatorTypes


@dataclass(frozen=True)
class OperatorAppendOptions:
    """Responsibilities: _operator family_, _parenthesized root boundary_."""

    boolean_group: bool
    root_parenthesized: bool


class PythonOperatorPrecedence:
    """Responsibilities: _boolean operator grouping_, _arithmetic operator grouping_."""

    def _arithmetic_operator(self, node: ast.AST) -> bool:
        """Responsibilities: _arithmetic operators identification_."""
        if type(node) is not ast.BinOp:
            return False
        return type(node.op) in (
            ast.Add,
            ast.Sub,
            ast.Mult,
            ast.Div,
            ast.FloorDiv,
            ast.Mod,
            ast.Pow,
        )

    def _same_group_parent(self, node: ast.AST, boolean_group: bool) -> bool:
        """Responsibilities: _same-group parent operators identification_."""
        parents = self.node_index.parents(node)
        if parents:
            parent = parents[0]
        else:
            parent = ast.AST()
        if self.expression_boundary.parenthesized(node):
            return False
        if boolean_group:
            if type(parent) is not ast.BoolOp:
                return False
            return type(parent.op) in (ast.And, ast.Or)
        return self._arithmetic_operator(parent)

    def _append_boolean_operators(
        self,
        node: ast.AST,
        operators: OperatorTypes,
        root_parenthesized: bool = False,
    ) -> None:
        """Responsibilities: _boolean operators collection_."""
        if self.expression_boundary.parenthesized(node):
            if not root_parenthesized:
                return
        if type(node) is ast.BoolOp:
            operators.add(type(node.op))
            for value in node.values:
                self._append_boolean_operators(value, operators)
            return
        if type(node) is ast.UnaryOp and type(node.op) is ast.Not:
            operators.add(type(node.op))
            self._append_boolean_operators(node.operand, operators)

    def _append_arithmetic_operators(
        self,
        node: ast.AST,
        operators: OperatorTypes,
        root_parenthesized: bool = False,
    ) -> None:
        """Responsibilities: _arithmetic operators collection_."""
        if self.expression_boundary.parenthesized(node):
            if not root_parenthesized:
                return
        if type(node) is not ast.BinOp:
            return
        operators.add(type(node.op))
        self._append_arithmetic_operators(node.left, operators)
        self._append_arithmetic_operators(node.right, operators)

    def _append_operators(
        self,
        node: ast.AST,
        operators: OperatorTypes,
        options: OperatorAppendOptions,
    ) -> None:
        """Responsibilities: _collection operators expression_."""
        if self.expression_boundary.parenthesized(node):
            if not options.root_parenthesized:
                return
        if options.boolean_group:
            self._append_boolean_operators(node, operators, options.root_parenthesized)
            return
        self._append_arithmetic_operators(node, operators, options.root_parenthesized)

    def _mixed(self, node: ast.AST, boolean_group: bool) -> bool:
        """Responsibilities: _mixed operator precedence identification_."""
        if self._same_group_parent(node, boolean_group):
            return False
        operators = self._expression_operators(node, boolean_group)
        if boolean_group:
            return self._mixed_boolean_operators(node, operators)
        return len(operators) > 1

    def _expression_operators(
        self, node: ast.AST, boolean_group: bool
    ) -> OperatorTypes:
        """Responsibilities: _expression operator collection_."""
        operators: OperatorTypes = set()
        self._append_operators(
            node,
            operators,
            OperatorAppendOptions(
                boolean_group,
                self.expression_boundary.parenthesized(node),
            ),
        )
        return operators

    def _mixed_boolean_operators(self, node: ast.AST, operators: OperatorTypes) -> bool:
        """Responsibilities: _mixed boolean operator classification_."""
        if ast.Not not in operators:
            return len(operators) > 1
        if self._binary_operator_count(node) < 2:
            return False
        return len(operators) > 1

    def _binary_operator_count(self, node: ast.AST) -> int:
        """Responsibilities: _binary operator count_."""
        if self.expression_boundary.parenthesized(node):
            return 0
        if type(node) is ast.BoolOp:
            return 1 + sum(self._binary_operator_count(value) for value in node.values)
        if type(node) is ast.UnaryOp and type(node.op) is ast.Not:
            return self._binary_operator_count(node.operand)
        return 0

    def __init__(
        self,
        tree: ast.AST,
        node_index: PythonAstNodeIndexContract,
        expression_boundary: PythonExpressionBoundaryContract,
    ) -> None:
        """Responsibilities: _operator precedence analysis initialization_."""
        self.tree: Any = tree
        self.expression_boundary: PythonExpressionBoundaryContract = expression_boundary
        self.node_index: Any = node_index

    def mixed_boolean_operator(self, node: ast.AST) -> list[JsonObject]:
        """Responsibilities: _collection mixed boolean precedence_."""
        if self.expression_boundary.negation_comparison_boundary(node):
            return [
                {"line": node.lineno - 1, "kind": PYTHON_MIXED_BOOLEAN_PRECEDENCE_KIND}
            ]
        if type(node) is ast.BoolOp and type(node.op) in (ast.And, ast.Or):
            if self._same_group_parent(node, True):
                return []
            if self._mixed(node, True):
                return [
                    {
                        "line": node.lineno - 1,
                        "kind": PYTHON_MIXED_BOOLEAN_PRECEDENCE_KIND,
                    }
                ]
        return []

    def mixed_arithmetic_operator(self, node: ast.AST) -> list[JsonObject]:
        """Responsibilities: _collection mixed arithmetic precedence_."""
        if self._arithmetic_operator(node):
            if self._mixed(node, False):
                return [
                    {"line": node.lineno - 1, "kind": "mixed-arithmetic-precedence"}
                ]
        return []
