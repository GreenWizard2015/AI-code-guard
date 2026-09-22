from __future__ import annotations

from typing import Any
import ast
from implementation.ast.protocols import PythonAstNodeIndexProtocol
from implementation.types import JsonObject


class UnionAnnotationRules:
    """Responsibilities: _classification Python unions detection_."""

    def _subscript_name(self, value: ast.AST) -> str:
        """Responsibilities: _identification subscript type name_."""
        if type(value) is ast.Name:
            return value.id
        if type(value) is ast.Attribute:
            return value.attr
        return ""

    def _is_optional_type(self, value: ast.AST) -> bool:
        """Responsibilities: _optional annotation types identification_."""
        if type(value) is not ast.Subscript:
            return False
        name: Any = self._subscript_name(value.value)
        if name == "Optional":
            return self._has_value_type([value.slice])
        if name != "Union" or type(value.slice) is not ast.Tuple:
            return False
        values: Any = list(value.slice.elts)
        return self._has_none(values) and self._has_value_type(values)

    def _has_none(self, values: list[ast.AST]) -> bool:
        """Responsibilities: _None union members identification_."""
        for value in values:
            if type(value) is ast.Constant and value.value is None:
                return True
        return False

    def _has_value_type(self, values: list[ast.AST]) -> bool:
        """Responsibilities: _non-None union members identification_."""
        for value in values:
            if not (type(value) is ast.Constant and value.value is None):
                return True
        return False

    def _is_nullish_type(self, value: ast.AST) -> bool:
        """Responsibilities: _nullish annotation types identification_."""
        if type(value) is ast.Constant and value.value is None:
            return True
        if type(value) is ast.Name:
            return value.id in {"Never", "NoReturn", "undefined"}
        return False

    def _union_types(self, node: ast.expr) -> list[ast.expr]:
        """Responsibilities: _flatten union expression types_."""
        if type(node) is not ast.BinOp:
            return [node]
        if type(node.op) is not ast.BitOr:
            return [node]
        return self._union_types(node.left) + self._union_types(node.right)

    def _intersection_types(self, node: ast.expr) -> list[ast.expr]:
        """Responsibilities: _flatten intersection expression types_."""
        if type(node) is not ast.BinOp:
            return [node]
        if type(node.op) is not ast.BitAnd:
            return [node]
        return self._intersection_types(node.left) + self._intersection_types(
            node.right
        )

    def _annotation_union_types(self, node: ast.AST) -> list[ast.AST]:
        """Responsibilities: _annotation union members collection_."""
        if type(node) is ast.BinOp and type(node.op) is ast.BitOr:
            return self._union_types(node)
        if type(node) is not ast.Subscript:
            return [node]
        if self._subscript_name(node.value) != "Union":
            return [node]
        if type(node.slice) is ast.Tuple:
            return list(node.slice.elts)
        return [node.slice]

    def _annotation_intersection_types(self, node: ast.AST) -> list[ast.AST]:
        """Responsibilities: _annotation intersection members collection_."""
        if type(node) is ast.BinOp and type(node.op) is ast.BitAnd:
            return self._intersection_types(node)
        return [node]

    def _annotation_composite_types(self, node: ast.AST) -> list[ast.AST]:
        """Responsibilities: _composite annotation members collection_."""
        union_types: Any = self._annotation_union_types(node)
        if len(union_types) > 1:
            return union_types
        return self._annotation_intersection_types(node)

    def _composite_children(
        self, node: ast.expr, candidates: list[ast.expr]
    ) -> list[ast.expr]:
        """Responsibilities: _nested composite candidates identification_."""
        if type(node) is not ast.BinOp:
            return []
        candidate_ids: Any = {id(item) for item in candidates}
        return [
            child for child in (node.left, node.right) if id(child) in candidate_ids
        ]

    def _issues_for_union(
        self, node: ast.AST, values: list[ast.AST]
    ) -> list[JsonObject]:
        """Responsibilities: _union annotation violations collection_."""
        issues: Any = []
        if len(values) > self.max_union_items:
            issues.append({"line": node.lineno - 1, "kind": "large-union"})
        if len(values) == 2:
            if self._has_none(values):
                issues.append(
                    {"line": node.lineno - 1, "kind": "python-optional-union"}
                )
            if self._has_none(values) and self._has_value_type(values):
                issues.append({"line": node.lineno - 1, "kind": "nullable-domain-type"})
        if len(values) > 1 and not any(
            self._is_nullish_type(value) for value in values
        ):
            issues.append({"line": node.lineno - 1, "kind": "composite-state-type"})
        return issues

    def _issues_for_intersection(
        self, node: ast.AST, values: list[ast.AST]
    ) -> list[JsonObject]:
        """Responsibilities: _intersection annotation violations collection_."""
        if len(values) <= 1 or any(self._is_nullish_type(value) for value in values):
            return []
        return [{"line": node.lineno - 1, "kind": "composite-state-type"}]

    def _annotation_issues(self, candidates: list[ast.AST]) -> list[JsonObject]:
        """Responsibilities: _annotation violations collection_."""
        nested: Any = {
            id(child)
            for item in candidates
            for child in self._composite_children(item, candidates)
        }
        issues: list[dict[str, Any]] = []
        for candidate in candidates:
            if id(candidate) in nested:
                continue
            issues.extend(self._issues_for_candidate(candidate))
        return issues

    def _issues_for_candidate(self, candidate: ast.AST) -> list[JsonObject]:
        """Responsibilities: _candidate's violations collection_."""
        values: Any = self._annotation_union_types(candidate)
        if len(values) > 1:
            return self._issues_for_union(candidate, values)
        intersection: Any = self._annotation_intersection_types(candidate)
        return self._issues_for_intersection(candidate, intersection)

    def __init__(
        self, max_union_items: int, node_index: PythonAstNodeIndexProtocol
    ) -> None:
        """Responsibilities: _union analysis initialization_."""
        self.max_union_items: Any = max_union_items
        self.node_index: Any = node_index

    def union(self, annotation: ast.AST) -> bool:
        """Responsibilities: _composite annotations identification_."""
        for item in self.node_index.nodes(annotation):
            if len(self._annotation_composite_types(item)) > 1:
                return True
        return False

    def issues_for_annotation(
        self, annotation: ast.AST, is_field: bool = False
    ) -> list[JsonObject]:
        """Responsibilities: _annotation violations collection_."""
        if is_field and self._is_nullish_type(annotation):
            return [{"line": annotation.lineno - 1, "kind": "nullable-domain-type"}]
        if self._is_optional_type(annotation):
            return [{"line": annotation.lineno - 1, "kind": "nullable-domain-type"}]
        if not self.union(annotation):
            return []
        candidates: Any = [
            item
            for item in self.node_index.nodes(annotation)
            if len(self._annotation_composite_types(item)) > 1
        ]
        return self._annotation_issues(candidates)
