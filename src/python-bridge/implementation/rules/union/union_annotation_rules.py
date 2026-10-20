from __future__ import annotations

import ast

from implementation.ast.protocols import PythonAstNodeIndexContract
from implementation.rules.protocols import PythonTypingAliasesContract
from implementation.references.protocols import PythonContainerAliasesContract
from implementation.rules.union.python_union_annotation_classifier import (
    PythonUnionAnnotationClassifier,
)
from implementation.rules.union.python_union_annotation_issue_collector import (
    PythonUnionAnnotationIssueCollector,
)
from implementation.rules.constants import PYTHON_NULLABLE_DOMAIN_RULE
from implementation.rules.union.protocols import (
    PythonUnionAnnotationClassifierContract,
    PythonUnionAnnotationIssueCollectorContract,
)
from implementation.types import JsonObject


class UnionAnnotationRules:
    """Responsibilities: _annotation analysis gating_, _union diagnostic collection_."""

    def __init__(
        self,
        max_union_items: int,
        node_index: PythonAstNodeIndexContract,
        python_typing_aliases: PythonTypingAliasesContract,
        container_aliases: PythonContainerAliasesContract,
    ) -> None:
        """Responsibilities: _union annotation rules initialization_."""
        classifier = PythonUnionAnnotationClassifier(
            node_index, python_typing_aliases, container_aliases
        )
        self.classifier: PythonUnionAnnotationClassifierContract = classifier
        self.issue_collector: PythonUnionAnnotationIssueCollectorContract = (
            PythonUnionAnnotationIssueCollector(max_union_items, classifier)
        )

    def requires_analysis(self, annotation: ast.AST, is_field: bool = False) -> bool:
        """Responsibilities: _annotation analysis requirement_."""
        if is_field:
            if self.classifier.nullish_type(annotation):
                return True
        if self.classifier.optional_type(annotation):
            return True
        return self.classifier.contains_union(annotation)

    def issues_for_annotation(
        self, annotation: ast.AST, is_field: bool = False
    ) -> list[JsonObject]:
        """Responsibilities: _annotation violations collection_."""
        if is_field:
            if self.classifier.nullish_type(annotation):
                return [
                    {"line": annotation.lineno - 1, "kind": PYTHON_NULLABLE_DOMAIN_RULE}
                ]
        if self.classifier.optional_type(annotation):
            return [
                {"line": annotation.lineno - 1, "kind": PYTHON_NULLABLE_DOMAIN_RULE}
            ]
        if not self.classifier.contains_union(annotation):
            return []
        candidates = [
            item
            for item in self.classifier.nodes(annotation)
            if len(self.classifier.annotation_composite_types(item)) > 1
        ]
        return self.issue_collector.issues_for_candidates(candidates)
