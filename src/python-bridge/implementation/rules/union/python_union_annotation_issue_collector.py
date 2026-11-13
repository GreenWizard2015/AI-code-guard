from __future__ import annotations

import ast

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
        optional_union_node: ast.expr,
        optional_members: list[ast.expr],
    ) -> list[JsonObject]:
        """Responsibilities: _optional union issue collection_."""
        if len(optional_members) != 2:
            return []
        if not any(type(item) is ast.Constant and item.value is None for item in optional_members):
            return []
        issues: list[JsonObject] = [
            {
                "line": optional_union_node.lineno - 1,
                "kind": PYTHON_OPTIONAL_UNION_RULE,
            },
        ]
        if any(not (type(item) is ast.Constant and item.value is None) for item in optional_members):
            issues.append(
                {
                    "line": optional_union_node.lineno - 1,
                    "kind": PYTHON_NULLABLE_DOMAIN_RULE,
                },
            )
        return issues

    def _issues_for_union(
        self,
        union_node: ast.expr,
        union_members: list[ast.expr],
    ) -> list[JsonObject]:
        """Responsibilities: _union annotation violations collection_."""
        line = union_node.lineno
        issues = self._union_size_issues(line, union_members)
        issues.extend(self._optional_union_issues(union_node, union_members))
        issues.extend(self._union_state_issues(line, union_members))
        return issues

    def _union_size_issues(self, line: int, candidates: list[ast.expr]) -> list[JsonObject]:
        """Responsibilities: _large union classification_."""
        if len(candidates) <= self._max_union_items:
            return []
        return [{"line": line - 1, "kind": PYTHON_LARGE_UNION_RULE}]

    def _union_state_issues(self, line: int, state_members: list[ast.expr]) -> list[JsonObject]:
        """Responsibilities: _composite union state classification_."""
        if len(state_members) <= 1:
            return []
        if any(self._classifier.nullish_type(value) for value in state_members):
            return []
        return [{"line": line - 1, "kind": PYTHON_COMPOSITE_STATE_RULE}]

    def _issues_for_intersection(
        self,
        intersection_node: ast.expr,
        intersection_members: list[ast.expr],
    ) -> list[JsonObject]:
        """Responsibilities: _intersection annotation violations collection_."""
        if len(intersection_members) <= 1:
            return []
        line = intersection_node.lineno
        if any(self._classifier.nullish_type(value) for value in intersection_members):
            return []
        return [
            {
                "line": line - 1,
                "kind": PYTHON_COMPOSITE_STATE_RULE,
            },
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
        annotation_node: ast.expr,
        annotation_values: list[ast.expr],
    ) -> list[JsonObject]:
        """Responsibilities: _union issue data_."""
        if len(annotation_values) > 1:
            return self._issues_for_union(annotation_node, annotation_values)
        return self._issues_for_intersection(annotation_node, annotation_values)

    def issues_for_candidates(self, candidates: list[ast.expr]) -> list[JsonObject]:
        """Responsibilities: _candidate annotation issue collection_."""
        candidate_ids = {id(item) for item in candidates}
        nested = {
            id(child)
            for item in candidates
            if type(item) is ast.BinOp
            for child in (item.left, item.right)
            if id(child) in candidate_ids
        }
        issues: list[JsonObject] = []
        for candidate in candidates:
            if id(candidate) in nested:
                continue
            values = self._classifier.annotation_composite_types(candidate)
            issues.extend(self.issues_for_values(candidate, values))
        return issues
