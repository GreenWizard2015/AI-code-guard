from __future__ import annotations


from functools import cached_property
from typing import Any
import ast
from implementation.rules.union_annotation_rules import UnionAnnotationRules
from implementation.ast.protocols import PythonAstNodeIndexProtocol
from implementation.types import JsonObject


class UnionRules:
    """Responsibilities: _classification Python type aliases_."""

    def _is_type_alias(self, value: ast.AST) -> bool:
        """Responsibilities: _classification expression defines type_."""
        if type(value) is not ast.BinOp:
            return False
        if type(value.op) not in (ast.BitOr, ast.BitAnd):
            return False
        return not all(
            type(item) is ast.Attribute for item in self._alias_leaves(value)
        )

    def _alias_leaves(self, value: ast.expr) -> list[ast.expr]:
        """Responsibilities: _flatten union expression alias_."""
        if type(value) is not ast.BinOp:
            return [value]
        if type(value.op) not in (ast.BitOr, ast.BitAnd):
            return [value]
        return self._alias_leaves(value.left) + self._alias_leaves(value.right)

    def _annotation_values(self, node: ast.AST) -> list[ast.AST]:
        """Responsibilities: _collection annotation expressions represented_."""
        if type(node) is ast.Assign:
            if node.value is not None:
                if self._is_type_alias(node.value):
                    return [node.value]
        if type(node) is ast.AnnAssign:
            if node.annotation is not None and id(node) in self.field_annotations:
                return [node.annotation]
        if type(node) is ast.arg:
            if node.annotation is not None:
                return [node.annotation]
        if type(node) in (ast.FunctionDef, ast.AsyncFunctionDef):
            if node.returns is not None:
                return [node.returns]
        return []

    def _type_value(self, value: ast.AST) -> bool:
        """Responsibilities: _classification value type expression_."""
        if type(value) in (ast.Name, ast.Attribute, ast.Subscript):
            return True
        if type(value) is not ast.BinOp:
            return False
        return type(value.op) in (ast.BitOr, ast.BitAnd)

    def _type_alias_assignment(self, item: ast.AST) -> bool:
        """Responsibilities: _classification assignment type-alias assignment_."""
        if type(item) is not ast.AnnAssign or type(item.target) is not ast.Name:
            return False
        if not item.target.id[:1].isupper() or item.value is None:
            return False
        return self._type_value(item.value)

    def _conditional_annotation_issue(self, node: ast.AST) -> list[JsonObject]:
        """Responsibilities: _reporting conditional composite annotations_."""
        if type(node) is not ast.If:
            return []
        branches = (node.body, node.orelse)
        if not any(
            any(self._type_alias_assignment(item) for item in branch)
            for branch in branches
        ):
            return []
        return [{"line": node.lineno - 1, "kind": "python-conditional-type-alias"}]

    def __init__(self, tree: ast.AST, node_index: PythonAstNodeIndexProtocol) -> None:
        """Responsibilities: _initialization Python tree node_."""
        self.tree: Any = tree
        self.node_index: Any = node_index
        self.annotation_rules: Any = UnionAnnotationRules(3, node_index)

    @cached_property
    def field_annotations(self) -> set[int]:
        """Responsibilities: _collection source nodes containing_."""
        annotations: set[int] = set()
        for class_node in self.node_index.nodes(self.tree):
            if type(class_node) is not ast.ClassDef:
                continue
            for statement in class_node.body:
                if type(statement) is ast.AnnAssign:
                    annotations.add(id(statement))
        return annotations

    def collect_union_issues(self, node: ast.AST) -> list[JsonObject]:
        """Responsibilities: _collection union conditional annotation_."""
        issues: list[JsonObject] = self._conditional_annotation_issue(node)
        for annotation in self._annotation_values(node):
            issues.extend(
                self.annotation_rules.issues_for_annotation(
                    annotation,
                    type(node) is ast.AnnAssign and id(node) in self.field_annotations,
                )
            )
        return issues
