from __future__ import annotations

import ast
from typing import Any

from implementation.types import JsonObject
from implementation.rules.constants import (
    PYTHON_COMPOSITE_STATE_RULE,
    PYTHON_LARGE_UNION_RULE,
    PYTHON_NULLABLE_DOMAIN_RULE,
    PYTHON_OPTIONAL_UNION_RULE,
)
from implementation.rules.union.protocols import (
    PythonUnionAnnotationClassifierContract,
)


class PythonUnionAnnotationIssueCollector:
    """Responsibilities: _union candidate analysis_, _annotation issue construction_."""

    def _optional_union_issues(
        self, node: ast.AST, values: list[ast.AST]
    ) -> list[JsonObject]:
        """Responsibilities: _optional union issue collection_."""
        if len(values) != 2:
            return []
        contains_none = any(
            type(item) is ast.Constant and item.value is None for item in values
        )
        if not contains_none:
            return []
        issues: list[JsonObject] = [
            {"line": node.lineno - 1, "kind": PYTHON_OPTIONAL_UNION_RULE}
        ]
        contains_value = any(
            not (type(item) is ast.Constant and item.value is None) for item in values
        )
        if contains_value:
            issues.append(
                {"line": node.lineno - 1, "kind": PYTHON_NULLABLE_DOMAIN_RULE}
            )
        return issues

    def _issues_for_union(
        self, node: ast.AST, values: list[ast.AST]
    ) -> list[JsonObject]:
        """Responsibilities: _union annotation violations collection_."""
        issues: list[JsonObject] = []
        if len(values) > self.max_union_items:
            issues.append({"line": node.lineno - 1, "kind": PYTHON_LARGE_UNION_RULE})
        issues.extend(self._optional_union_issues(node, values))
        if len(values) > 1:
            has_nullish_type = any(
                self.classifier.nullish_type(value) for value in values
            )
            if not has_nullish_type:
                issues.append(
                    {"line": node.lineno - 1, "kind": PYTHON_COMPOSITE_STATE_RULE}
                )
        return issues

    def _issues_for_intersection(
        self, node: ast.AST, values: list[ast.AST]
    ) -> list[JsonObject]:
        """Responsibilities: _intersection annotation violations collection_."""
        if len(values) <= 1:
            return []
        if any(self.classifier.nullish_type(value) for value in values):
            return []
        return [{"line": node.lineno - 1, "kind": PYTHON_COMPOSITE_STATE_RULE}]

    def __init__(
        self,
        max_union_items: int,
        classifier: PythonUnionAnnotationClassifierContract,
    ) -> None:
        """Responsibilities: _union issue collection initialization_."""
        self.max_union_items: int = max_union_items
        self.classifier: PythonUnionAnnotationClassifierContract = classifier

    def issues_for_values(
        self, node: ast.AST, values: list[ast.AST]
    ) -> list[JsonObject]:
        """Responsibilities: _union issue data_."""
        if len(values) > 1:
            return self._issues_for_union(node, values)
        return self._issues_for_intersection(node, values)

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
            values = self.classifier.annotation_composite_types(candidate)
            issues.extend(self.issues_for_values(candidate, values))
        return issues
