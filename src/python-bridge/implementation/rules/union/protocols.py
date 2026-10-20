from __future__ import annotations

import ast
from typing import Protocol

from implementation.ast.protocols import PythonAstNodeIndexContract
from implementation.rules.protocols import (
    PythonTypingAliasesContract,
    PythonUnionAnnotationRulesContract,
)
from implementation.references.protocols import PythonContainerAliasesContract
from implementation.types import JsonObject


class PythonUnionAnnotationClassifierContract(Protocol):
    """Responsibilities: _Python union annotation classification_."""

    def annotation_composite_types(self, node: ast.AST) -> list[ast.AST]: ...

    def contains_union(self, annotation: ast.AST) -> bool: ...

    def nullish_type(self, value: ast.AST) -> bool: ...

    def optional_type(self, value: ast.AST) -> bool: ...

    def nodes(self, annotation: ast.AST) -> list[ast.AST]: ...


class PythonUnionAnnotationIssueCollectorContract(Protocol):
    """Responsibilities: _union issue data_."""

    def issues_for_candidates(self, candidates: list[ast.AST]) -> list[JsonObject]: ...

    def issues_for_values(
        self, node: ast.AST, values: list[ast.AST]
    ) -> list[JsonObject]: ...


class UnionRulesOptionsContract(Protocol):
    """Responsibilities: _union dependency access_."""

    def tree(self) -> ast.AST: ...

    def node_index(self) -> PythonAstNodeIndexContract: ...

    def container_aliases(self) -> PythonContainerAliasesContract: ...

    def python_typing_aliases(self) -> PythonTypingAliasesContract: ...

    def annotation_rules(self) -> PythonUnionAnnotationRulesContract: ...
