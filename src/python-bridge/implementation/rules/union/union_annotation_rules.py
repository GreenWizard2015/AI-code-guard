from __future__ import annotations

import ast

from implementation.ast.protocols import PythonAstNodeIndexContract
from implementation.rules.constants import PYTHON_NULLABLE_DOMAIN_RULE
from implementation.rules.protocols import PythonTypingAliasesContract
from implementation.rules.union.protocols import (
    PythonUnionAnnotationClassifierContract,
    PythonUnionAnnotationIssueCollectorContract,
)
from implementation.rules.union.python_union_annotation_classifier import (
    PythonUnionAnnotationClassifier,
)
from implementation.rules.union.python_union_annotation_issue_collector import (
    PythonUnionAnnotationIssueCollector,
)
from implementation.types import JsonObject


class UnionAnnotationRules:
    """Responsibilities: _annotation analysis gating_, _union diagnostic collection_."""

    def _composite_candidates(self, union_node: ast.expr) -> list[ast.expr]:
        """Responsibilities: _composite union candidate selection_."""
        candidates: list[ast.expr] = []
        for item in self._classifier.nodes(union_node):
            match item:
                case ast.expr() as expression:
                    if len(self._classifier.annotation_composite_types(expression)) > 1:
                        candidates.append(expression)
        return candidates

    def __init__(
        self,
        max_union_items: int,
        node_index: PythonAstNodeIndexContract,
        python_typing_aliases: PythonTypingAliasesContract,
    ) -> None:
        """Responsibilities: _union annotation rules initialization_."""
        classifier = PythonUnionAnnotationClassifier(node_index, python_typing_aliases)
        self._classifier: PythonUnionAnnotationClassifierContract = classifier
        self._issue_collector: PythonUnionAnnotationIssueCollectorContract = PythonUnionAnnotationIssueCollector(
            max_union_items,
            classifier,
        )

    def requires_analysis(self, annotation: ast.expr, is_field: bool = False) -> bool:
        """Responsibilities: _annotation analysis requirement_."""
        if is_field:
            if self._classifier.nullish_type(annotation):
                return True
        if self._classifier.optional_type(annotation):
            return True
        return self._classifier.contains_union(annotation)

    def issues_for_annotation(
        self,
        annotation: ast.expr,
        is_field: bool = False,
    ) -> list[JsonObject]:
        """Responsibilities: _annotation violations collection_."""
        nullable = False
        if is_field:
            nullable = self._classifier.nullish_type(annotation)
        if not nullable:
            nullable = self._classifier.optional_type(annotation)
        if nullable:
            return [{"line": annotation.lineno - 1, "kind": PYTHON_NULLABLE_DOMAIN_RULE}]
        if not self._classifier.contains_union(annotation):
            return []
        return self._issue_collector.issues_for_candidates(self._composite_candidates(annotation))
