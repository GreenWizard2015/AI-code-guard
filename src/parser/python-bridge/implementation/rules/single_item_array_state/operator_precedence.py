from __future__ import annotations


from functools import cached_property
from typing import Any
import ast

from implementation.ast.protocols import PythonAstNodeIndexProtocol
from implementation.rules.single_item_array_state.expression_boundary import (
    PythonExpressionBoundary,
)
from implementation.types import JsonObject, OperatorTypes


class PythonOperatorPrecedence:
    """Responsibilities: _detection mixed Python operator_."""

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
        parent = self._parents.get(id(node), ast.AST())
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
        boolean_group: bool,
        root_parenthesized: bool = False,
    ) -> None:
        """Responsibilities: _collection operators expression_."""
        if self.expression_boundary.parenthesized(node):
            if not root_parenthesized:
                return
        if boolean_group:
            self._append_boolean_operators(node, operators, root_parenthesized)
            return
        self._append_arithmetic_operators(node, operators, root_parenthesized)

    def _mixed(self, node: ast.AST, boolean_group: bool) -> bool:
        """Responsibilities: _mixed operator precedence identification_."""
        if self._same_group_parent(node, boolean_group):
            return False
        if boolean_group:
            if self.expression_boundary.ungrouped(
                node,
                self.expression_boundary.parenthesized(node),
            ):
                return True
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
            boolean_group,
            self.expression_boundary.parenthesized(node),
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

    @cached_property
    def _parents(self) -> dict[int, ast.AST]:
        """Responsibilities: _collection Python AST parent_."""
        parents: dict[int, ast.AST] = {}
        for parent in self.node_index.nodes(self.tree):
            for child in ast.iter_child_nodes(parent):
                parents[id(child)] = parent
        return parents

    def __init__(
        self,
        tree: ast.AST,
        source_lines: list[str],
        node_index: PythonAstNodeIndexProtocol,
    ) -> None:
        """Responsibilities: _operator precedence analysis initialization_."""
        self.tree: Any = tree
        self.expression_boundary: PythonExpressionBoundary = PythonExpressionBoundary(
            source_lines
        )
        self.node_index: Any = node_index

    def mixed_boolean_operator(self, node: ast.AST) -> list[JsonObject]:
        """Responsibilities: _collection mixed boolean precedence_."""
        if self.expression_boundary.negation_comparison_boundary(node):
            return [{"line": node.lineno - 1, "kind": "mixed-boolean-precedence"}]
        if type(node) is ast.BoolOp and type(node.op) in (ast.And, ast.Or):
            if self._same_group_parent(node, True):
                return []
            if self._mixed(node, True):
                return [{"line": node.lineno - 1, "kind": "mixed-boolean-precedence"}]
        return []

    def mixed_arithmetic_operator(self, node: ast.AST) -> list[JsonObject]:
        """Responsibilities: _collection mixed arithmetic precedence_."""
        if self._arithmetic_operator(node):
            if self._mixed(node, False):
                return [
                    {"line": node.lineno - 1, "kind": "mixed-arithmetic-precedence"}
                ]
        return []
