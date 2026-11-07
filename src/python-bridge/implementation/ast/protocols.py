from __future__ import annotations

import ast
from collections.abc import Sequence
from contextlib import AbstractContextManager
from typing import TYPE_CHECKING, Protocol

from implementation.ast.class_nodes.protocols import (
    PythonClassFieldRecordContract,
    PythonClassNodeDetailsContract,
    PythonClassNodeFieldsContract,
    PythonInstanceFieldNamesContract,
    PythonInstanceFieldRecordsContract,
    PythonSlotFieldsContract,
    PythonUntypedClassFieldsContract,
)
from implementation.ast.content_protocols import (
    PythonAstContentCollectorContract,
    PythonAstContentTreeViewContract,
)

__all__ = [
    "PythonAstContentCollectorContract",
    "PythonAstContentTreeViewContract",
    "PythonClassFieldRecordContract",
    "PythonClassNodeDetailsContract",
    "PythonClassNodeFieldsContract",
    "PythonInstanceFieldNamesContract",
    "PythonInstanceFieldRecordsContract",
    "PythonSlotFieldsContract",
    "PythonUntypedClassFieldsContract",
]

if TYPE_CHECKING:
    from implementation.references.protocols import (
        PythonContainerAliasesContract,
        PythonContainerKeysContract,
        PythonContainerValuesContract,
        PythonReferenceAliasesContract,
        PythonScopedTypeAliasesContract,
    )
    from implementation.types import JsonObject, LiteralMetadata, PythonCallableAstNode
    from protocols import (
        PythonImportNodesContract,
        PythonImportRulesContract,
        PythonModuleInstanceCollectorContract,
        PythonReferenceCollectorContract,
    )


class PythonTypeDeclarationCollectorContract(Protocol):
    """Responsibilities: _type declaration collection contract_."""

    def type_alias_annotation(self, annotation: ast.AST) -> bool: ...

    def declarations(self, nodes: list[ast.AST]) -> list[JsonObject]: ...


class PythonLiteralMetadataContract(Protocol):
    """Responsibilities: _literal metadata collection_."""

    def collect(self) -> LiteralMetadata: ...


class PythonAstParserContract(Protocol):
    """Responsibilities: _parsed AST response contract_."""

    def __init__(self, source: str) -> None: ...

    def ast(self) -> JsonObject: ...

    def timings_data(self) -> dict[str, float]: ...


class PythonAstReferenceContentContract(Protocol):
    """Responsibilities: _AST reference content collection_."""

    def collect(self) -> JsonObject: ...


class PythonAstMetadataContract(Protocol):
    """Responsibilities: _AST metadata analysis_."""

    def export_names(self) -> list[str]: ...

    def docstring_locations(self) -> list[JsonObject]: ...


class PythonModuleInstanceStatementContract(Protocol):
    """Responsibilities: _module statement aliases_."""

    def node(self) -> ast.AST: ...

    def main_guard(self) -> bool: ...

    def assignment_value(self) -> ast.expr: ...

    def assignment_target_values(
        self,
        reference_aliases: PythonReferenceAliasesContract,
    ) -> dict[str, ast.AST]: ...


class PythonModuleInstanceAliasStateContract(Protocol):
    """Responsibilities: _module instance alias state_."""

    def record(self, statement: PythonModuleInstanceStatementContract) -> None: ...

    def instance_records(self, value: ast.AST) -> list[JsonObject]: ...


class PythonScopedTypeAliasIndexContract(Protocol):
    """Responsibilities: _scoped type alias indexing_."""

    def source_tree(self) -> ast.AST: ...

    def source_node_index(self) -> PythonAstNodeIndexContract: ...

    def add_alias(self, name: str, target: str, scope: ast.AST, line: int) -> None: ...


class PythonStoredSymbolContextContract(Protocol):
    """Responsibilities: _symbol classification inputs_."""

    def tree(self) -> ast.AST: ...

    def node_index(self) -> PythonAstNodeIndexContract: ...

    def callable_arguments(self) -> PythonCallableArgumentsContract: ...

    def type_collector(self) -> PythonTypeDeclarationCollectorContract: ...


class PythonResponsibilityTargetsContract(Protocol):
    """Responsibilities: _responsibility target collection_."""

    def collect(self) -> list[JsonObject]: ...


class PythonAstCoreStateContract(Protocol):
    """Responsibilities: _AST core state_."""

    def source_dependencies(self) -> PythonAstCoreDependenciesContract: ...
    def container_aliases(self) -> PythonContainerAliasesContract: ...
    def container_values(self) -> PythonContainerValuesContract: ...
    def container_keys(self) -> PythonContainerKeysContract: ...


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
    def reference_aliases(self) -> PythonReferenceAliasesContract: ...
    def references(self) -> PythonReferenceCollectorContract: ...


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


class PythonAstImportPathStateContract(Protocol):
    """Responsibilities: _import path state contract_."""

    def configure(self, tree: ast.Module) -> None: ...
    def path_mutation(self, node: ast.AST) -> bool: ...


class PythonSysPathStateContract(Protocol):
    """Responsibilities: _sys.path alias resolution_."""

    def container_keys(self) -> PythonContainerKeysContract: ...

    def path_mutating(self, name: str) -> bool: ...
    def path_mutator_name(self, name: str) -> bool: ...
    def path_target(self, target: ast.AST) -> bool: ...
    def configure(self, tree: ast.Module) -> None: ...


class PythonSysPathImportAliasesContract(Protocol):
    """Responsibilities: _sys.path import alias ownership_."""

    def observe_imports(self, tree: ast.AST) -> None: ...
    def add_path_alias(self, alias: str) -> bool: ...
    def system_name(self, name: str) -> bool: ...
    def path_name(self, name: str) -> bool: ...


class PythonSysPathAttributeAliasesContract(Protocol):
    """Responsibilities: _sys.path attribute alias index_."""

    def clear(self) -> None: ...
    def key_count(self) -> int: ...
    def record(
        self,
        assigned_attribute: ast.Attribute,
        assignment_context: ast.AST,
    ) -> None: ...
    def contains(self, queried_attribute: ast.Attribute) -> bool: ...


class PythonAstReferenceStateContract(Protocol):
    """Responsibilities: _reference state contract_."""

    def aliases(self) -> PythonReferenceAliasesContract: ...
    def collector(self) -> PythonReferenceCollectorContract: ...


class PythonAstTreeStateContract(Protocol):
    """Responsibilities: _AST analysis state groups_."""

    def core(self) -> PythonAstCoreStateContract: ...
    def callables(self) -> PythonAstCallableStateContract: ...
    def imports(self) -> PythonAstImportStateContract: ...

    def tree_dependencies(self) -> PythonAstTreeDependenciesContract: ...


class PythonAstNodeIndexContract(Protocol):
    """Responsibilities: _AST node parent indexing_."""

    def nodes(self, root: ast.AST) -> list[ast.AST]: ...
    def alias_event_nodes(self, root: ast.AST, nodes: Sequence[ast.AST]) -> list[ast.AST]: ...
    def class_definitions(self, root: ast.AST) -> list[ast.ClassDef]: ...
    def children(self, node: ast.AST) -> list[ast.AST]: ...
    def parents(self, node: ast.AST) -> list[ast.AST]: ...
    def scopes(self, root: ast.AST) -> dict[ast.AST, str]: ...


class PythonAsyncNameOverlayContract(Protocol):
    """Responsibilities: _test-local async name overlay_."""

    def update_test_aliases(self, node: ast.AST) -> None: ...
    def async_call_name(self, statement: ast.Expr) -> str: ...


class PythonAstSymbolNodesContract(Protocol):
    """Responsibilities: _Python symbol collection contract_."""

    def named_symbols(self) -> list[JsonObject]: ...
    def type_declarations(self) -> list[JsonObject]: ...
    def module_instances(self) -> list[JsonObject]: ...


class PythonAstSymbolNodesOptionsContract(Protocol):
    """Responsibilities: _symbol analysis inputs_."""

    @property
    def tree(self) -> ast.Module: ...

    @property
    def node_index(self) -> PythonAstNodeIndexContract: ...

    @property
    def callable_arguments(self) -> PythonCallableArgumentsContract: ...

    @property
    def type_collector(self) -> PythonTypeDeclarationCollectorContract: ...

    @property
    def instance_collector(self) -> PythonModuleInstanceCollectorContract: ...


class PythonFunctionNodesContract(Protocol):
    """Responsibilities: _function node collection_."""

    def nodes(self) -> list[JsonObject]: ...
    def source_functions(self) -> list[JsonObject]: ...
    def callable_count(self) -> JsonObject: ...


class PythonSourceSegmentsContract(Protocol):
    """Responsibilities: _source segment operations contract_."""

    def line(self, line_number: int) -> str: ...
    def character_column(self, line: str, byte_column: int) -> int: ...
    def segment(self, node: ast.AST) -> str: ...
    def significant_characters(self, text: str) -> int: ...


class PythonModuleConstantSpansContract(Protocol):
    """Responsibilities: _module declaration span collection_."""

    def collect_spans(self) -> list[JsonObject]: ...
    def collect_types(self) -> list[JsonObject]: ...
    def collect_protocols(self) -> list[JsonObject]: ...


class PythonStructureIssuesContract(Protocol):
    """Responsibilities: _AST structure diagnostics_."""

    def deep_attribute_accesses(self, tree: ast.Module) -> list[JsonObject]: ...
    def repeated_branches(self, tree: ast.Module) -> list[JsonObject]: ...


class PythonFunctionSelectorContract(Protocol):
    """Responsibilities: _Python function selection contract_."""

    def nodes(self) -> list[ast.AST]: ...
    def source_nodes(self) -> list[ast.AST]: ...

    def nested(self, node: ast.AST) -> bool: ...

    def owner_name(self, node: ast.AST) -> str: ...


class PythonFunctionOwnerContract(Protocol):
    """Responsibilities: _enclosing function ownership_, _nested function lookup_."""

    def resolve(self, node: ast.AST) -> ast.AST: ...

    def nested(self, node: ast.AST) -> bool: ...


class PythonCallableStatementsContract(Protocol):
    """Responsibilities: _callable statement operations contract_."""

    def body_without_docstring(self, body: list[ast.stmt]) -> list[ast.stmt]: ...

    def statement_node(self, node: ast.stmt) -> JsonObject: ...

    def string_statement(self, statement: ast.stmt) -> bool: ...

    def collect_docstring_lines(
        self,
        root: ast.AST,
        node_index: PythonAstNodeIndexContract,
    ) -> set[int]: ...

    def count_non_docstring_lines(
        self,
        root: ast.AST,
        node_index: PythonAstNodeIndexContract,
        first_line: int,
        last_line: int,
    ) -> int: ...


class PythonTestAssertionDataContract(Protocol):
    """Responsibilities: _test assertion metadata contract_."""

    def collect(
        self,
        node: PythonCallableAstNode,
        callable_statements: PythonCallableStatementsContract,
    ) -> JsonObject: ...


class PythonTestAssertionAliasesContract(Protocol):
    """Responsibilities: _test assertion alias contract_."""

    def assertion_alias_present(self) -> bool: ...

    def assertion_call(self, node: ast.Call) -> bool: ...

    def exception_assertion(self, node: ast.Call) -> bool: ...


class PythonCallableArgumentsContract(Protocol):
    """Responsibilities: _callable argument operations contract_."""

    def for_callable(self, node: ast.AST) -> PythonCallableArgumentContextContract: ...

    def structural_type(self, node: ast.AST) -> bool: ...


class PythonCallableArgumentContextContract(Protocol):
    """Responsibilities: _owned callable signature_, _callable metadata_."""

    def visibility(self) -> str: ...

    def metadata(self, characters: int) -> JsonObject: ...


class PythonCallableMetricsContract(Protocol):
    """Responsibilities: _callable metric operations contract_."""

    def statements_sloc(self, items: list[ast.stmt]) -> int: ...

    def control_flow_depth(self, items: list[ast.stmt]) -> int: ...


class PythonCodingIssueTimingContract(Protocol):
    """Responsibilities: _coding issue timing operations_."""

    def collect(
        self,
        nodes: list[ast.AST],
        proxy_issues: list[JsonObject],
        issues: list[JsonObject],
    ) -> None: ...

    def add_duration(self, name: str, elapsed_ms: float) -> None: ...

    def measure(self, name: str) -> AbstractContextManager[None]: ...

    def durations(self) -> dict[str, float]: ...


class PythonTestOrderDependencyContract(Protocol):
    """Responsibilities: _shared mutable test-state contract_."""

    def issues(self) -> list[JsonObject]: ...


class PythonCallableConditionContextContract(Protocol):
    """Responsibilities: _callable condition scope_, _test function context_."""

    def test_function(self, node: ast.AST) -> bool: ...

    def contains_callable_condition(self, node: ast.Call) -> bool: ...


class PythonSubtestAliasesContract(Protocol):
    """Responsibilities: _subtest alias matching contract_."""

    def aliases_for(self, node: ast.AST) -> set[str]: ...

    def matches(self, node: ast.AST, aliases: set[str]) -> bool: ...


class PythonFunctionNodeContextContract(Protocol):
    """Responsibilities: _function node analysis context_."""

    @property
    def source_segments(self) -> PythonSourceSegmentsContract: ...

    @property
    def function_selector(self) -> PythonFunctionSelectorContract: ...

    @property
    def test_assertion_data(self) -> PythonTestAssertionDataContract: ...

    @property
    def callable_arguments(self) -> PythonCallableArgumentsContract: ...

    @property
    def callable_metrics(self) -> PythonCallableMetricsContract: ...

    @property
    def callable_statements(self) -> PythonCallableStatementsContract: ...


class PythonClassNodeOptionsContract(Protocol):
    """Responsibilities: _class normalization inputs_."""

    @property
    def node(self) -> ast.ClassDef: ...

    @property
    def source(self) -> str: ...

    @property
    def node_index(self) -> PythonAstNodeIndexContract: ...

    @property
    def source_segments(self) -> PythonSourceSegmentsContract: ...

    @property
    def container_aliases(self) -> PythonContainerAliasesContract: ...

    @property
    def type_aliases(self) -> PythonScopedTypeAliasesContract: ...

    @property
    def module_body(self) -> list[ast.stmt]: ...
