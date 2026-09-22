from __future__ import annotations


from functools import cached_property
from typing import Any
import ast

from implementation.ast.protocols import PythonAstNodeIndexProtocol
from implementation.types import JsonObject, OperatorTypes


class PythonOperatorPrecedence:
    """Responsibilities: _detection mixed Python operator_."""

    def _previous_character(self, node: ast.AST) -> str:
        """Responsibilities: _character before expression access_."""
        line = self.source_lines[node.lineno - 1]
        index = node.col_offset
        while index > 0:
            index -= 1
            if not line[index].isspace():
                return line[index]
        return ""

    def _end_line(self, node: ast.AST) -> int:
        """Responsibilities: _identification expression end line_."""
        if node.end_lineno is not None:
            return node.end_lineno
        return node.lineno

    def _next_character(self, node: ast.AST) -> str:
        """Responsibilities: _character after expression access_."""
        line = self.source_lines[self._end_line(node) - 1]
        index = self._end_column(node)
        while index < len(line):
            if not line[index].isspace():
                return line[index]
            index += 1
        return ""

    def _end_column(self, node: ast.AST) -> int:
        """Responsibilities: _identification expression end column_."""
        if node.end_col_offset is not None:
            return node.end_col_offset
        return 0

    def _is_parenthesized(self, node: ast.AST) -> bool:
        """Responsibilities: _parenthesized expressions identification_."""
        previous = self._previous_character(node)
        following = self._next_character(node)
        if previous != "(":
            return False
        return following == ")"

    def _boolean_operator(self, node: ast.AST) -> bool:
        """Responsibilities: _boolean operators identification_."""
        if type(node) is not ast.BoolOp:
            return False
        return type(node.op) in (ast.And, ast.Or)

    def _arithmetic_operator(self, node: ast.AST) -> bool:
        """Responsibilities: _arithmetic operators identification_."""
        if type(node) is not ast.BinOp:
            return False
        return type(node.op) in (ast.Add, ast.Sub, ast.Mult, ast.Div)

    def _same_group_parent(self, node: ast.AST, boolean_group: bool) -> bool:
        """Responsibilities: _same-group parent operators identification_."""
        parent = self._parents.get(id(node), ast.AST())
        if self._is_parenthesized(node):
            return False
        if boolean_group:
            return self._boolean_operator(parent)
        return self._arithmetic_operator(parent)

    def _append_boolean_operators(
        self, node: ast.AST, operators: OperatorTypes
    ) -> None:
        """Responsibilities: _boolean operators collection_."""
        if self._is_parenthesized(node):
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
        self, node: ast.AST, operators: OperatorTypes
    ) -> None:
        """Responsibilities: _arithmetic operators collection_."""
        if self._is_parenthesized(node):
            return
        if type(node) is not ast.BinOp:
            return
        operators.add(type(node.op))
        self._append_arithmetic_operators(node.left, operators)
        self._append_arithmetic_operators(node.right, operators)

    def _append_operators(
        self, node: ast.AST, operators: OperatorTypes, boolean_group: bool
    ) -> None:
        """Responsibilities: _collection operators expression_."""
        if self._is_parenthesized(node):
            return
        if boolean_group:
            self._append_boolean_operators(node, operators)
            return
        self._append_arithmetic_operators(node, operators)

    def _mixed(self, node: ast.AST, boolean_group: bool) -> bool:
        """Responsibilities: _mixed operator precedence identification_."""
        if self._same_group_parent(node, boolean_group):
            return False
        operators: OperatorTypes = set()
        self._append_operators(node, operators, boolean_group)
        if (
            boolean_group
            and ast.Not in operators
            and self._binary_operator_count(node) < 2
        ):
            return False
        return len(operators) > 1

    def _binary_operator_count(self, node: ast.AST) -> int:
        """Responsibilities: _binary operator count_."""
        if self._is_parenthesized(node):
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
        self.source_lines: Any = source_lines
        self.node_index: Any = node_index

    def mixed_boolean_operator(self, node: ast.AST) -> list[JsonObject]:
        """Responsibilities: _collection mixed boolean precedence_."""
        if self._boolean_operator(node) and self._mixed(node, True):
            return [{"line": node.lineno - 1, "kind": "mixed-boolean-precedence"}]
        return []

    def mixed_arithmetic_operator(self, node: ast.AST) -> list[JsonObject]:
        """Responsibilities: _collection mixed arithmetic precedence_."""
        if self._arithmetic_operator(node) and self._mixed(node, False):
            return [{"line": node.lineno - 1, "kind": "mixed-arithmetic-precedence"}]
        return []
