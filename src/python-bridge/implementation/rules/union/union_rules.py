from __future__ import annotations

import ast

from implementation.references.protocols import PythonContainerAliasesContract
from implementation.rules.protocols import PythonUnionAnnotationRulesContract
from implementation.rules.union.protocols import (
    PythonConditionalTypeAliasAnalysisContract,
    PythonObservedTypingAliasesContract,
    PythonUnionDeclarationAnnotationsContract,
    UnionRulesOptionsContract,
)
from implementation.rules.union.python_conditional_type_alias_analysis import (
    PythonConditionalTypeAliasAnalysis,
)
from implementation.rules.union.python_union_declaration_annotations import (
    PythonUnionDeclarationAnnotations,
)
from implementation.types import JsonObject


class UnionRules:
    """Responsibilities: _typing alias preparation_, _union annotation analysis_."""

    def _observe_aliases(self, node: ast.AST) -> None:
        """Responsibilities: _typing alias context_."""
        self._container_aliases.clear()
        if type(self._tree) is ast.Module:
            for statement in self._declaration_annotations.module_alias_statements():
                self._python_typing_aliases.observe(statement)
        self._python_typing_aliases.observe(node)

    def __init__(self, options: UnionRulesOptionsContract) -> None:
        """Responsibilities: _union analysis setup_."""
        self._tree: ast.AST = options.tree()
        self._container_aliases: PythonContainerAliasesContract = options.container_aliases()
        self._python_typing_aliases: PythonObservedTypingAliasesContract = options.python_typing_aliases()
        self._annotation_rules: PythonUnionAnnotationRulesContract = options.annotation_rules()
        self._type_alias_analysis: PythonConditionalTypeAliasAnalysisContract = PythonConditionalTypeAliasAnalysis(
            options.node_index(),
        )
        self._declaration_annotations: PythonUnionDeclarationAnnotationsContract = PythonUnionDeclarationAnnotations(
            self._tree,
            options.node_index(),
            self._type_alias_analysis,
        )

    def conditional_type_issues(self, conditional_node: ast.AST) -> list[JsonObject]:
        """Responsibilities: _conditional type alias issues_."""
        self._observe_aliases(conditional_node)
        return self._type_alias_analysis.issue(conditional_node)

    def annotation_issues(self, declaration_node: ast.AST) -> list[JsonObject]:
        """Responsibilities: _annotation issue collection_."""
        self._observe_aliases(declaration_node)
        is_field = self._declaration_annotations.field_declaration(declaration_node)
        issues: list[JsonObject] = []
        for annotation in self._declaration_annotations.annotations(declaration_node):
            if self._annotation_rules.requires_analysis(annotation, is_field):
                issues.extend(
                    self._annotation_rules.issues_for_annotation(annotation, is_field),
                )
        return issues
