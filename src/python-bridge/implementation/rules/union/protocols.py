from __future__ import annotations

import ast
from typing import Protocol

from implementation.ast.protocols import PythonAstNodeIndexContract
from implementation.references.protocols import PythonContainerAliasesContract
from implementation.rules.protocols import (
    PythonUnionAnnotationRulesContract,
)
from implementation.types import JsonObject


class PythonUnionAnnotationClassifierContract(Protocol):
    """Responsibilities: _Python union annotation classification_."""

    def annotation_composite_types(self, node: ast.expr) -> list[ast.expr]: ...

    def contains_union(self, annotation: ast.expr) -> bool: ...

    def nullish_type(self, value: ast.AST) -> bool: ...

    def optional_type(self, value: ast.AST) -> bool: ...

    def nodes(self, annotation: ast.AST) -> list[ast.AST]: ...


class PythonUnionAnnotationIssueCollectorContract(Protocol):
    """Responsibilities: _union issue data_."""

    def issues_for_candidates(self, candidates: list[ast.expr]) -> list[JsonObject]: ...

    def issues_for_values(
        self,
        node: ast.expr,
        values: list[ast.expr],
    ) -> list[JsonObject]: ...


class UnionRulesOptionsContract(Protocol):
    """Responsibilities: _union dependency access_."""

    def tree(self) -> ast.AST: ...

    def node_index(self) -> PythonAstNodeIndexContract: ...

    def container_aliases(self) -> PythonContainerAliasesContract: ...

    def python_typing_aliases(self) -> PythonObservedTypingAliasesContract: ...

    def annotation_rules(self) -> PythonUnionAnnotationRulesContract: ...


class PythonConditionalTypeAliasAnalysisContract(Protocol):
    """Responsibilities: _conditional type alias diagnostics_."""

    def type_alias(self, alias_expression: ast.AST) -> bool: ...

    def issue(self, node: ast.AST) -> list[JsonObject]: ...


class PythonUnionDeclarationAnnotationsContract(Protocol):
    """Responsibilities: _union declaration annotation lookup_."""

    def annotations(self, node: ast.AST) -> list[ast.expr]: ...

    def field_declaration(self, field_candidate: ast.AST) -> bool: ...

    def module_alias_statements(self) -> list[ast.stmt]: ...


class PythonObservedTypingAliasesContract(Protocol):
    """Responsibilities: _typing alias observation_."""

    def expression_name(self, expression: ast.AST) -> str: ...

    def matches_optional(self, name: str) -> bool: ...

    def matches_union(self, name: str) -> bool: ...

    def observe(self, node: ast.AST) -> None: ...
