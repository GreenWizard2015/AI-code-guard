from __future__ import annotations

import ast
from typing import Any

from implementation.rules.constants import (
    PYTHON_COMPOSITE_STATE_RULE,
    PYTHON_LARGE_UNION_RULE,
    PYTHON_NULLABLE_DOMAIN_RULE,
    PYTHON_OPTIONAL_UNION_RULE,
)
from implementation.rules.union.protocols import (
    PythonUnionAnnotationClassifierContract,
)
from implementation.types import JsonObject


class PythonUnionAnnotationIssueCollector:
    """Responsibilities: _union candidate analysis_, _annotation issue construction_."""

    def _optional_union_issues(
        self,
        optional_union_node: ast.AST,
        optional_union_members: list[ast.AST],
    ) -> list[JsonObject]:
        """Responsibilities: _optional union issue collection_."""
        if len(optional_union_members) != 2:
            return []
        if not any(type(item) is ast.Constant and item.value is None for item in optional_union_members):
            return []
        issues: list[JsonObject] = [
            {"line": optional_union_node.lineno - 1, "kind": PYTHON_OPTIONAL_UNION_RULE},
        ]
        if any(not (type(item) is ast.Constant and item.value is None) for item in optional_union_members):
            issues.append(
                {
                    "line": optional_union_node.lineno - 1,
                    "kind": PYTHON_NULLABLE_DOMAIN_RULE,
                },
            )
        return issues

    def _issues_for_union(
        self,
        union_node: ast.AST,
        union_members: list[ast.AST],
    ) -> list[JsonObject]:
        """Responsibilities: _union annotation violations collection_."""
        issues: list[JsonObject] = []
        if len(union_members) > self._max_union_items:
            issues.append(
                {"line": union_node.lineno - 1, "kind": PYTHON_LARGE_UNION_RULE},
            )
        issues.extend(self._optional_union_issues(union_node, union_members))
        if len(union_members) > 1:
            has_nullish_type = any(self._classifier.nullish_type(value) for value in union_members)
            if not has_nullish_type:
                issues.append(
                    {"line": union_node.lineno - 1, "kind": PYTHON_COMPOSITE_STATE_RULE},
                )
        return issues

    def _issues_for_intersection(
        self,
        intersection_node: ast.AST,
        intersection_members: list[ast.AST],
    ) -> list[JsonObject]:
        """Responsibilities: _intersection annotation violations collection_."""
        if len(intersection_members) <= 1:
            return []
        if any(self._classifier.nullish_type(value) for value in intersection_members):
            return []
        return [
            {"line": intersection_node.lineno - 1, "kind": PYTHON_COMPOSITE_STATE_RULE},
        ]

    def __init__(
        self,
        max_union_items: int,
        classifier: PythonUnionAnnotationClassifierContract,
    ) -> None:
        """Responsibilities: _union issue collection initialization_."""
        self._max_union_items: int = max_union_items
        self._classifier: PythonUnionAnnotationClassifierContract = classifier

    def issues_for_values(
        self,
        annotation_node: ast.AST,
        annotation_values: list[ast.AST],
    ) -> list[JsonObject]:
        """Responsibilities: _union issue data_."""
        if len(annotation_values) > 1:
            return self._issues_for_union(annotation_node, annotation_values)
        return self._issues_for_intersection(annotation_node, annotation_values)

    def issues_for_candidates(self, candidates: list[ast.AST]) -> list[JsonObject]:
        """Responsibilities: _candidate annotation issue collection_."""
        candidate_ids = {id(item) for item in candidates}
        nested = {
            id(child)
            for item in candidates
            if type(item) is ast.BinOp
            for child in (item.left, item.right)
            if id(child) in candidate_ids
        }
        issues: list[dict[str, Any]] = []
        for candidate in candidates:
            if id(candidate) in nested:
                continue
            values = self._classifier.annotation_composite_types(candidate)
            issues.extend(self.issues_for_values(candidate, values))
        return issues
