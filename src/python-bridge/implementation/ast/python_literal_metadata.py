from __future__ import annotations

import ast

from implementation.protocols import PythonAstContentTreeContract
from implementation.rules.constants import (
    PYTHON_MAIN_NAME,
    PYTHON_MAIN_VALUE,
    PYTHON_TYPE_ALIAS_NAME,
)
from implementation.types import JsonObject, LiteralMetadata


class PythonLiteralMetadata:
    """Responsibilities: _literal classification_, _docstring reference collection_."""

    def _type_alias_annotation(self, annotation: ast.AST) -> bool:
        """Responsibilities: _type alias annotation classification_."""
        if type(annotation) is ast.Name:
            return annotation.id == PYTHON_TYPE_ALIAS_NAME
        if type(annotation) is ast.Attribute:
            return annotation.attr == PYTHON_TYPE_ALIAS_NAME
        return False

    def _parent_excludes_literal(self, parent: ast.AST, node: ast.AST) -> bool:
        """Responsibilities: _literal parent exclusion decision_."""
        if type(parent) is ast.Dict and node in parent.keys:
            return True
        if type(parent) is ast.AnnAssign:
            return self._type_alias_annotation(parent.annotation)
        if type(parent) is ast.arg:
            return parent.annotation is node
        if type(parent) is ast.Compare:
            return self._main_guard_literal(parent, node)
        if type(parent) in (ast.FunctionDef, ast.AsyncFunctionDef):
            return parent.returns is node
        return False

    def _excluded_by_parent(self, node: ast.AST) -> bool:
        """Responsibilities: _literal parent exclusion_."""
        for parent in self.tree.node_index.parents(node):
            if self._parent_excludes_literal(parent, node):
                return True
        return False

    def _main_guard_literal(self, parent: ast.Compare, node: ast.AST) -> bool:
        """Responsibilities: _main guard literal exclusion_."""
        if type(parent.left) is not ast.Name or parent.left.id != PYTHON_MAIN_NAME:
            return False
        if len(parent.comparators) != 1:
            return False
        comparator = parent.comparators[0]
        return (
            type(comparator) is ast.Constant
            and comparator is node
            and comparator.value == PYTHON_MAIN_VALUE
        )

    def _append_constant(
        self,
        target: ast.AST,
        value: ast.AST,
        constant_values: dict[int, str],
        constants: list[JsonObject],
    ) -> None:
        """Responsibilities: _constant literal registration_."""
        if type(target) is not ast.Name:
            return
        if not target.id.isupper():
            return
        literal = self.literal_value(value)
        if not literal:
            return
        constant_values[id(value)] = target.id
        constants.append(
            {"value": literal, "name": target.id, "line": value.lineno - 1}
        )

    def _append_statement_constants(
        self,
        statement: ast.AST,
        constant_values: dict[int, str],
        constants: list[JsonObject],
    ) -> None:
        """Responsibilities: _assignment constant registration_."""
        if type(statement) is ast.Assign:
            for target in statement.targets:
                self._append_constant(
                    target, statement.value, constant_values, constants
                )
            return
        if type(statement) is ast.AnnAssign and statement.value is not None:
            self._append_constant(
                statement.target, statement.value, constant_values, constants
            )

    def _docstrings(self) -> set[int]:
        """Responsibilities: _docstring literal collection_."""
        nodes: set[int] = set()
        for node in self.tree.node_index.nodes(self.tree.tree):
            if type(node) is not ast.Expr:
                continue
            if type(node.value) is ast.Constant and type(node.value.value) is str:
                nodes.add(id(node.value))
        return nodes

    def _references(
        self, constant_values: dict[int, str], docstrings: set[int]
    ) -> list[JsonObject]:
        """Responsibilities: _literal reference collection_."""
        references: list[JsonObject] = []
        for node in self.tree.node_index.nodes(self.tree.tree):
            value = self.literal_value(node)
            if not value:
                continue
            if id(node) in docstrings:
                continue
            if id(node) in constant_values:
                continue
            references.append({"value": value, "line": node.lineno - 1})
        return references

    def __init__(self, tree: PythonAstContentTreeContract) -> None:
        """Responsibilities: _literal metadata initialization_."""
        self.tree: PythonAstContentTreeContract = tree

    def literal_value(self, node: ast.AST) -> str:
        """Responsibilities: _literal value classification_."""
        if type(node) is not ast.Constant:
            return ""
        if type(node.value) is not str:
            return ""
        if len(node.value) < 8:
            return ""
        if self._excluded_by_parent(node):
            return ""
        return node.value

    def collect(self) -> LiteralMetadata:
        """Responsibilities: _literal metadata collection_."""
        constant_values: dict[int, str] = {}
        constants: list[JsonObject] = []
        for statement in self.tree.tree.body:
            self._append_statement_constants(statement, constant_values, constants)
        return {
            "references": self._references(constant_values, self._docstrings()),
            "constants": constants,
        }
