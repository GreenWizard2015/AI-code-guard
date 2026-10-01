from __future__ import annotations


from functools import cached_property
from typing import Any
import ast
from implementation.rules.union_annotation_rules import UnionAnnotationRules
from implementation.rules.python_syntax.typing_aliases import PythonTypingAliases
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

    def _assignment_annotations(self, node: ast.AST) -> list[ast.AST]:
        """Responsibilities: _collection assigned type annotations_."""
        if type(node) is not ast.Assign:
            return []
        if self._is_type_alias(node.value):
            return [node.value]
        return []

    def _field_annotations(self, node: ast.AST) -> list[ast.AST]:
        """Responsibilities: _collection field type annotations_."""
        if type(node) is not ast.AnnAssign:
            return []
        if node.annotation is None:
            return []
        if id(node) not in self.field_annotations:
            return []
        return [node.annotation]

    def _callable_annotations(self, node: ast.AST) -> list[ast.AST]:
        """Responsibilities: _collection callable type annotations_."""
        if type(node) is ast.arg:
            if node.annotation is not None:
                return [node.annotation]
            return []
        if type(node) not in (ast.FunctionDef, ast.AsyncFunctionDef):
            return []
        if node.returns is None:
            return []
        return [node.returns]

    def _annotation_values(self, node: ast.AST) -> list[ast.AST]:
        """Responsibilities: _collection annotation expressions represented_."""
        values = self._assignment_annotations(node)
        if values:
            return values
        values = self._field_annotations(node)
        if values:
            return values
        return self._callable_annotations(node)

    def _type_value(self, value: ast.AST) -> bool:
        """Responsibilities: _classification value type expression_."""
        if type(value) in (ast.Name, ast.Attribute, ast.Subscript):
            return True
        if type(value) is not ast.BinOp:
            return False
        return type(value.op) in (ast.BitOr, ast.BitAnd)

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

    def _nested_alias(self, node: ast.AST) -> bool:
        """Responsibilities: _nested branch aliases_."""
        if type(node) is ast.If:
            return False
        if self._type_alias_assignment(node):
            return True
        return any(self._nested_alias(child) for child in ast.iter_child_nodes(node))

    def _conditional_annotation_issue(self, node: ast.AST) -> list[JsonObject]:
        """Responsibilities: _reporting conditional composite annotations_."""
        if type(node) is not ast.If:
            return []
        branches = (node.body, node.orelse)
        if not any(
            any(self._nested_alias(item) for item in branch) for branch in branches
        ):
            return []
        return [{"line": node.lineno - 1, "kind": "python-conditional-type-alias"}]

    def __init__(self, tree: ast.AST, node_index: PythonAstNodeIndexProtocol) -> None:
        """Responsibilities: _initialization Python tree node_."""
        self.tree: Any = tree
        self.node_index: Any = node_index
        self.typing_aliases: PythonTypingAliases = PythonTypingAliases()
        self.annotation_rules: Any = UnionAnnotationRules(
            3, node_index, self.typing_aliases
        )

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
        self.typing_aliases.configure(self.tree)
        self.typing_aliases.observe(node)
        issues: list[JsonObject] = self._conditional_annotation_issue(node)
        is_field_annotation = False
        if type(node) is ast.AnnAssign:
            is_field_annotation = id(node) in self.field_annotations
        for annotation in self._annotation_values(node):
            issues.extend(
                self.annotation_rules.issues_for_annotation(
                    annotation,
                    is_field_annotation,
                )
            )
        return issues
