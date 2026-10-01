from __future__ import annotations

from typing import Any
import ast
from implementation.ast.protocols import PythonAstNodeIndexProtocol
from implementation.rules.protocols import PythonTypingAliasesProtocol
from implementation.rules.union_annotation_shapes import PythonUnionAnnotationShapes
from implementation.types import JsonObject


class UnionAnnotationRules:
    """Responsibilities: _classification Python unions detection_."""

    def _is_optional_type(self, value: ast.AST) -> bool:
        """Responsibilities: _optional annotation types identification_."""
        if type(value) is not ast.Subscript:
            return False
        name: Any = self.shapes.subscript_name(value.value)
        if self.typing_aliases.matches_optional(name):
            return self._has_value_type([value.slice])
        if name != "Union" or type(value.slice) is not ast.Tuple:
            return False
        values: Any = list(value.slice.elts)
        if not self._has_none(values):
            return False
        return self._has_value_type(values)

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

    def _optional_union_issues(
        self, node: ast.AST, values: list[ast.AST]
    ) -> list[JsonObject]:
        """Responsibilities: _optional union issue collection_."""
        if len(values) != 2:
            return []
        if not self._has_none(values):
            return []
        issues: list[JsonObject] = [
            {"line": node.lineno - 1, "kind": "python-optional-union"}
        ]
        if self._has_value_type(values):
            issues.append({"line": node.lineno - 1, "kind": "nullable-domain-type"})
        return issues

    def _issues_for_union(
        self, node: ast.AST, values: list[ast.AST]
    ) -> list[JsonObject]:
        """Responsibilities: _union annotation violations collection_."""
        issues: Any = []
        if len(values) > self.max_union_items:
            issues.append({"line": node.lineno - 1, "kind": "large-union"})
        issues.extend(self._optional_union_issues(node, values))
        if len(values) > 1:
            has_nullish_type = any(self._is_nullish_type(value) for value in values)
            if not has_nullish_type:
                issues.append({"line": node.lineno - 1, "kind": "composite-state-type"})
        return issues

    def _issues_for_intersection(
        self, node: ast.AST, values: list[ast.AST]
    ) -> list[JsonObject]:
        """Responsibilities: _intersection annotation violations collection_."""
        if len(values) <= 1:
            return []
        if any(self._is_nullish_type(value) for value in values):
            return []
        return [{"line": node.lineno - 1, "kind": "composite-state-type"}]

    def _annotation_issues(self, candidates: list[ast.AST]) -> list[JsonObject]:
        """Responsibilities: _annotation violations collection_."""
        nested: Any = {
            id(child)
            for item in candidates
            for child in self.shapes._composite_children(item, candidates)
        }
        issues: list[dict[str, Any]] = []
        for candidate in candidates:
            if id(candidate) in nested:
                continue
            issues.extend(self._issues_for_candidate(candidate))
        return issues

    def _issues_for_candidate(self, candidate: ast.AST) -> list[JsonObject]:
        """Responsibilities: _candidate's violations collection_."""
        values: Any = self.shapes.annotation_union_types(candidate)
        if len(values) > 1:
            return self._issues_for_union(candidate, values)
        intersection: Any = self.shapes.annotation_intersection_types(candidate)
        return self._issues_for_intersection(candidate, intersection)

    def __init__(
        self,
        max_union_items: int,
        node_index: PythonAstNodeIndexProtocol,
        typing_aliases: PythonTypingAliasesProtocol,
    ) -> None:
        """Responsibilities: _union analysis initialization_."""
        self.max_union_items: Any = max_union_items
        self.node_index: Any = node_index
        self.typing_aliases: PythonTypingAliasesProtocol = typing_aliases
        self.shapes: PythonUnionAnnotationShapes = PythonUnionAnnotationShapes(
            typing_aliases
        )

    def union(self, annotation: ast.AST) -> bool:
        """Responsibilities: _composite annotations identification_."""
        for item in self.node_index.nodes(annotation):
            if len(self.shapes.annotation_composite_types(item)) > 1:
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
            if len(self.shapes.annotation_composite_types(item)) > 1
        ]
        return self._annotation_issues(candidates)
