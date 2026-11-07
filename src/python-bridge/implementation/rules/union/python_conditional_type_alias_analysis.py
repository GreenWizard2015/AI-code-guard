from __future__ import annotations

import ast

from implementation.ast.protocols import PythonAstNodeIndexContract
from implementation.rules.union.protocols import (
    PythonConditionalTypeAliasAnalysisContract,
)
from implementation.types import JsonObject


class PythonConditionalTypeAliasAnalysis(PythonConditionalTypeAliasAnalysisContract):
    """Responsibilities: _type alias classification_, _conditional diagnostics_."""

    def __init__(self, node_index: PythonAstNodeIndexContract) -> None:
        """Responsibilities: _type alias source ownership_."""
        self._node_index: PythonAstNodeIndexContract = node_index

    def type_alias(self, alias_expression: ast.AST) -> bool:
        """Responsibilities: _classification expression defines type_."""
        if type(alias_expression) is not ast.BinOp:
            return False
        if type(alias_expression.op) not in (ast.BitOr, ast.BitAnd):
            return False
        return not all(type(item) is ast.Attribute for item in self._alias_leaves(alias_expression))

    def _alias_leaves(self, expression: ast.expr) -> list[ast.expr]:
        """Responsibilities: _flatten union expression alias_."""
        if type(expression) is not ast.BinOp:
            return [expression]
        if type(expression.op) not in (ast.BitOr, ast.BitAnd):
            return [expression]
        return self._alias_leaves(expression.left) + self._alias_leaves(
            expression.right,
        )

    def _type_value(self, type_expression: ast.AST) -> bool:
        """Responsibilities: _classification value type expression_."""
        if type(type_expression) in (ast.Name, ast.Attribute, ast.Subscript):
            return True
        if type(type_expression) is not ast.BinOp:
            return False
        return type(type_expression.op) in (ast.BitOr, ast.BitAnd)

    def _regular_type_alias(self, item: ast.Assign) -> bool:
        """Responsibilities: _regular type alias_."""
        if len(item.targets) != 1:
            return False
        target = item.targets[0]
        if type(target) is not ast.Name:
            return False
        if not target.id[:1].isupper():
            return False
        return self._type_value(item.value)

    def _annotated_type_alias(self, item: ast.AnnAssign) -> bool:
        """Responsibilities: _annotated type alias_."""
        if type(item.target) is not ast.Name:
            return False
        if not item.target.id[:1].isupper():
            return False
        if item.value is None:
            return False
        return self._type_value(item.value)

    def _type_alias_assignment(self, item: ast.AST) -> bool:
        """Responsibilities: _assignment type alias_."""
        if type(item) is ast.Assign:
            return self._regular_type_alias(item)
        if type(item) is ast.AnnAssign:
            return self._annotated_type_alias(item)
        return False

    def _nested_alias(self, branch_statement: ast.AST) -> bool:
        """Responsibilities: _nested branch aliases_."""
        if type(branch_statement) is ast.If:
            return False
        if self._type_alias_assignment(branch_statement):
            return True
        return any(self._nested_alias(child) for child in self._node_index.children(branch_statement))

    def issue(self, node: ast.AST) -> list[JsonObject]:
        """Responsibilities: _conditional composite annotation diagnosis_."""
        if type(node) is not ast.If:
            return []
        branches = (node.body, node.orelse)
        if not any(any(self._nested_alias(item) for item in branch) for branch in branches):
            return []
        return [{"line": node.lineno - 1, "kind": "python-conditional-type-alias"}]
