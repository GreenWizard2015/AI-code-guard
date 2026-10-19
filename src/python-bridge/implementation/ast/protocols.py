from __future__ import annotations

import ast
from typing import Protocol

from implementation.protocols import (
    PythonAstNodeIndexContract,
    PythonAstSymbolNodesContract,
    PythonCallableStatementsContract,
    PythonFunctionNodesContract,
    PythonImportNodesContract,
    PythonImportRulesContract,
    PythonModuleConstantSpansContract,
    PythonReferenceCollectorContract,
    PythonSourceSegmentsContract,
    PythonStructureIssuesContract,
)
from implementation.references.aliases.protocols import (
    PythonContainerAliasesContract,
    PythonContainerKeysContract,
    PythonContainerValuesContract,
    PythonReferenceAliasesContract,
    PythonScopedTypeAliasesContract,
)
from implementation.types import JsonObject, LiteralMetadata


class PythonLiteralMetadataContract(Protocol):
    """Responsibilities: _literal metadata collection_."""

    def collect(self) -> LiteralMetadata: ...


class PythonResponsibilityTargetsContract(Protocol):
    """Responsibilities: _responsibility target collection_."""

    def collect(self) -> list[JsonObject]: ...


class PythonAstCoreStateContract(Protocol):
    """Responsibilities: _AST core state_."""

    def source_dependencies(self) -> PythonAstCoreDependenciesContract: ...
    def container_aliases(self) -> PythonContainerAliasesContract: ...
    def container_values(self) -> PythonContainerValuesContract: ...
    def container_keys(self) -> PythonContainerKeysContract: ...


class PythonAstImportStateOptionsContract(Protocol):
    """Responsibilities: _import AST state options_."""

    def source_tree(self) -> ast.Module: ...
    def source_node_index(self) -> PythonAstNodeIndexContract: ...
    def source_container_aliases(self) -> PythonContainerAliasesContract: ...
    def source_reference_aliases(self) -> PythonReferenceAliasesContract: ...
    def source_structure_issues(self) -> PythonStructureIssuesContract: ...


class PythonAstCallableDependenciesContract(Protocol):
    """Responsibilities: _callable dependency access_."""

    def function_nodes(self) -> PythonFunctionNodesContract: ...
    def symbols(self) -> PythonAstSymbolNodesContract: ...


class PythonAstCallableStateContract(Protocol):
    """Responsibilities: _AST callable state_."""

    def function_nodes(self) -> PythonFunctionNodesContract: ...
    def symbols(self) -> PythonAstSymbolNodesContract: ...
    def callable_statements(self) -> PythonCallableStatementsContract: ...


class PythonAstImportStateContract(Protocol):
    """Responsibilities: _AST import state_."""

    def import_rules(self) -> PythonImportRulesContract: ...
    def structure_issues(self) -> PythonStructureIssuesContract: ...


class PythonAstCoreDependenciesContract(Protocol):
    """Responsibilities: _core AST dependency access_."""

    def source_text(self) -> str: ...
    def syntax_tree(self) -> ast.Module: ...
    def node_index(self) -> PythonAstNodeIndexContract: ...
    def import_nodes(self) -> PythonImportNodesContract: ...
    def source_segments(self) -> PythonSourceSegmentsContract: ...
    def structure_issues(self) -> PythonStructureIssuesContract: ...


class PythonAstTreeDependenciesContract(Protocol):
    """Responsibilities: _tree dependency access_."""

    def callable_statements(self) -> PythonCallableStatementsContract: ...
    def type_aliases(self) -> PythonScopedTypeAliasesContract: ...
    def module_constants(self) -> PythonModuleConstantSpansContract: ...
    def reference_aliases(self) -> PythonReferenceAliasesContract: ...
    def references(self) -> PythonReferenceCollectorContract: ...


class PythonAstImportPathStateContract(Protocol):
    """Responsibilities: _import path state contract_."""

    def configure(self, tree: ast.Module) -> None: ...
    def path_mutation(self, node: ast.AST) -> bool: ...


class PythonAstReferenceStateContract(Protocol):
    """Responsibilities: _reference state contract_."""

    def aliases(self) -> PythonReferenceAliasesContract: ...
    def collector(self) -> PythonReferenceCollectorContract: ...


class PythonAstTreeStateContract(Protocol):
    """Responsibilities: _AST analysis state groups_."""

    def core(self) -> PythonAstCoreStateContract: ...
    def callables(self) -> PythonAstCallableStateContract: ...
    def imports(self) -> PythonAstImportStateContract: ...
