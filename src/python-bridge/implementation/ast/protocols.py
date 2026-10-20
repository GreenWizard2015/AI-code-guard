from __future__ import annotations

import ast
from typing import Protocol, TYPE_CHECKING

if TYPE_CHECKING:
    from protocols import PythonReferenceCollectorContract
    from protocols import PythonImportNodesContract, PythonImportRulesContract
    from implementation.references.protocols import (
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


class PythonSysPathImportAliasesContract(Protocol):
    """Responsibilities: _sys.path import alias ownership_."""

    def observe_imports(self, nodes: list[ast.AST]) -> None: ...
    def add_path_alias(self, name: str) -> bool: ...
    def system_name(self, name: str) -> bool: ...
    def path_name(self, name: str) -> bool: ...


class PythonAstReferenceStateContract(Protocol):
    """Responsibilities: _reference state contract_."""

    def aliases(self) -> PythonReferenceAliasesContract: ...
    def collector(self) -> PythonReferenceCollectorContract: ...


class PythonAstTreeStateContract(Protocol):
    """Responsibilities: _AST analysis state groups_."""

    def core(self) -> PythonAstCoreStateContract: ...
    def callables(self) -> PythonAstCallableStateContract: ...
    def imports(self) -> PythonAstImportStateContract: ...


class PythonAstNodeIndexContract(Protocol):
    """Responsibilities: _AST node parent indexing_."""

    def nodes(self, root: ast.AST) -> list[ast.AST]: ...
    def children(self, node: ast.AST) -> list[ast.AST]: ...
    def parents(self, node: ast.AST) -> list[ast.AST]: ...
    def scopes(self, root: ast.AST) -> dict[ast.AST, str]: ...


class PythonAsyncNameOverlayContract(Protocol):
    """Responsibilities: _async binding visibility_, _test-local async transitions_."""

    def contains(self, name: str) -> bool: ...
    def add(self, name: str) -> None: ...
    def discard(self, name: str) -> None: ...


class PythonAstSymbolNodesContract(Protocol):
    """Responsibilities: _Python symbol collection contract_."""

    def named_symbols(self) -> list[JsonObject]: ...
    def type_declarations(self) -> list[JsonObject]: ...
    def module_instances(self) -> list[JsonObject]: ...


class PythonFunctionNodesContract(Protocol):
    """Responsibilities: _function node collection_."""

    def nodes(self) -> list[JsonObject]: ...
    def callable_count(self) -> JsonObject: ...


class PythonSourceSegmentsContract(Protocol):
    """Responsibilities: _source segment operations contract_."""

    def line(self, line_number: int) -> str: ...
    def character_column(self, line: str, byte_column: int) -> int: ...
    def segment(self, node: ast.AST) -> str: ...
    def significant_characters(self, text: str) -> int: ...


class PythonClassNodeFieldsContract(Protocol):
    """Responsibilities: _Python class field collection_."""

    def fields(self) -> list[JsonObject]: ...
    def untyped_fields(self) -> list[JsonObject]: ...


class PythonPrivateAccessOptionsContract(Protocol):
    """Responsibilities: _private access dependency data_."""

    def data(self) -> JsonObject: ...


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

    def nested(self, node: ast.AST) -> bool: ...


class PythonCallableStatementsContract(Protocol):
    """Responsibilities: _callable statement operations contract_."""

    def body_without_docstring(self, body: list[ast.stmt]) -> list[ast.stmt]: ...

    def statement_node(self, node: ast.stmt) -> JsonObject: ...


class PythonTestAssertionDataContract(Protocol):
    """Responsibilities: _test assertion metadata contract_."""

    def collect(
        self, node: ast.AST, callable_statements: PythonCallableStatementsContract
    ) -> JsonObject: ...


class PythonTestAssertionAliasesContract(Protocol):
    """Responsibilities: _test assertion alias contract_."""

    def assertion_alias_present(self) -> bool: ...

    def assertion_call(self, node: ast.Call) -> bool: ...

    def exception_assertion(self, node: ast.Call) -> bool: ...


class PythonCallableArgumentsContract(Protocol):
    """Responsibilities: _callable argument operations contract_."""

    def callable_arguments(self, node: ast.AST) -> list[ast.arg]: ...

    def argument_metadata(
        self, node: ast.AST, arguments: list[ast.arg], characters: int
    ) -> JsonObject: ...


class PythonCallableMetricsContract(Protocol):
    """Responsibilities: _callable metric operations contract_."""

    def statements_sloc(self, items: list[ast.stmt]) -> int: ...

    def control_flow_depth(self, items: list[ast.stmt]) -> int: ...


class PythonTestOrderDependencyContract(Protocol):
    """Responsibilities: _shared mutable test-state contract_."""

    def module_mutable_names(self) -> set[str]: ...

    def issues(self) -> list[JsonObject]: ...


class PythonCallableConditionContextContract(Protocol):
    """Responsibilities: _callable condition scope_, _test function context_."""

    def test_function(self, node: ast.AST) -> bool: ...

    def contains_callable_condition(self, node: ast.Call) -> bool: ...


class PythonSubtestAliasesContract(Protocol):
    """Responsibilities: _subtest alias matching contract_."""

    def matches(self, node: ast.AST) -> bool: ...
