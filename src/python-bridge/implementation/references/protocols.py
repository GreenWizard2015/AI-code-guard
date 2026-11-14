from __future__ import annotations

import ast
from collections.abc import Mapping
from typing import TYPE_CHECKING, Protocol, TypeAlias

from implementation.references.alias_types import CallablePythonReferenceOperation
from implementation.references.reference_alias_protocols import (
    PythonAssignmentAliasContract,
    PythonContainerAliasContract,
    PythonContainerAliasesContract,
    PythonContainerAliasStateContract,
    PythonContainerAssemblyContract,
    PythonContainerItemRequestContract,
    PythonContainerItemsContract,
    PythonContainerKeysContract,
    PythonContainerLookupContract,
    PythonContainerValuesContract,
    PythonDynamicTypeReferencesContract,
    PythonExceptionAliasSnapshotContract,
    PythonExceptionAliasStateContract,
    PythonProxyReceiverAliasesContract,
    PythonProxyScopeAliasIndexContract,
    PythonReferenceAliasesContract,
    PythonReferenceAliasStateContract,
    PythonScopeAliasHistoryContract,
)
from implementation.types import JsonObject, PythonASTLocatedNode

__all__ = [
    "CallablePythonReferenceOperation",
    "PythonAssignmentAliasContract",
    "PythonContainerAliasContract",
    "PythonContainerAliasStateContract",
    "PythonContainerAliasesContract",
    "PythonContainerAssemblyContract",
    "PythonContainerItemRequestContract",
    "PythonContainerItemsContract",
    "PythonContainerKeysContract",
    "PythonContainerLookupContract",
    "PythonContainerValuesContract",
    "PythonDynamicTypeReferencesContract",
    "PythonExceptionAliasSnapshotContract",
    "PythonExceptionAliasStateContract",
    "PythonProxyReceiverAliasesContract",
    "PythonProxyScopeAliasIndexContract",
    "PythonReferenceAliasStateContract",
    "PythonReferenceAliasesContract",
    "PythonScopeAliasHistoryContract",
    "PythonTestAssertionAliasOptionsContract",
]


if TYPE_CHECKING:
    from implementation.ast.protocols import PythonAstNodeIndexContract


class PythonSubtestAliasesOptionsContract(Protocol):
    """Responsibilities: _subtest source state_, _alias resolver dependencies_."""

    @property
    def tree(self) -> ast.AST: ...

    @property
    def node_index(self) -> PythonAstNodeIndexContract: ...

    @property
    def container_aliases(self) -> PythonContainerAliasesContract: ...

    @property
    def container_keys(self) -> PythonContainerKeysContract: ...

    @property
    def assignment_aliases(self) -> PythonReferenceAliasesContract: ...


class PythonTestAssertionAliasOptionsContract(Protocol):
    """Responsibilities: _assertion AST_, _assertion alias dependencies_."""

    @property
    def node(self) -> ast.AST: ...

    @property
    def node_index(self) -> PythonAstNodeIndexContract: ...

    @property
    def container_aliases(self) -> PythonContainerAliasesContract: ...

    @property
    def container_keys(self) -> PythonContainerKeysContract: ...

    @property
    def container_values(self) -> PythonContainerValuesContract: ...

    @property
    def assignment_aliases(self) -> PythonReferenceAliasesContract: ...


class PythonSubtestAliasAnalysisContract(Protocol):
    """Responsibilities: _subtest alias results_, _context matching_."""

    @property
    def aliases(self) -> set[str]: ...

    def matches(self, aliases: set[str]) -> bool: ...


class PythonAnnotationResolverContract(Protocol):
    """Responsibilities: _annotation name resolution contract_."""

    def annotation_name(
        self,
        annotation: ast.expr,
        aliases: Mapping[str, str],
        generics: set[str],
    ) -> str: ...

    def resolve_constructor(
        self,
        value: ast.AST,
        class_names: set[str],
        constructor_aliases: Mapping[str, str],
    ) -> str: ...


class PythonReferenceContextContract(Protocol):
    """Responsibilities: _reference context state contract_."""

    def bindings(self) -> PythonReferenceBindingsContract: ...

    def properties(self) -> PythonReferencePropertiesContract: ...

    def name_resolver(self) -> PythonReferenceNameResolverContract: ...

    def attribute_owner(self, value: ast.AST, current_owner: str) -> str: ...

    def collection_element_owner(self, value: ast.AST, current_owner: str) -> str: ...


class PythonReferenceSourceContract(Protocol):
    """Responsibilities: _Python reference source data_."""

    def context(
        self,
        annotation_resolver: PythonAnnotationResolverContract,
    ) -> PythonReferenceContextContract: ...


class PythonReferenceBindingsContract(Protocol):
    """Responsibilities: _instance bindings_, _collection bindings_."""

    def instance_owner(self, name: str, node: ast.AST) -> str: ...

    def record_binding(self, name: str, owner: str, collection_owner: str, node: ast.AST) -> None: ...

    def collection_element_owner(self, name: str, node: ast.AST) -> str: ...

    def instance_binding_present(self, name: str, node: ast.AST) -> bool: ...

    def collection_state(self) -> PythonScopedOwnerStateContract: ...


class PythonReferencePropertiesContract(Protocol):
    """Responsibilities: _property type ownership operations_."""

    def owner(self, owner: str, property_name: str, node: ast.AST) -> str: ...

    def record(self, owner: str, property_name: str, value: str, node: ast.AST) -> None: ...

    def record_type(self, name: str, owner: str, node: ast.AST) -> None: ...

    def record_elements(self, name: str, element_type: str, node: ast.AST) -> None: ...


class PythonReferenceOwnershipOptionsContract(Protocol):
    """Responsibilities: _reference ownership inputs_."""

    def symbol_tables(self) -> PythonReferenceSymbolTablesContract: ...

    def call_return_values(self) -> PythonCallReturnStateContract: ...

    def ast_index(self) -> PythonAstNodeIndexContract: ...


class PythonReferenceNameResolverContract(Protocol):
    """Responsibilities: _reference name resolution contract_."""

    def alias_target(self, name: str) -> str: ...

    def annotation_name(
        self,
        resolver: PythonAnnotationResolverContract,
        annotation: ast.expr,
        generics: set[str],
    ) -> str: ...

    def callable_key(self, node: ast.AST) -> str: ...

    def call_return_owner(
        self,
        function: ast.AST,
        node: ast.AST,
        fallback_to_name: bool,
    ) -> str: ...

    def method_return_owner(self, name: str, owner: str) -> str: ...


class PythonReferenceSymbolTablesContract(Protocol):
    """Responsibilities: _reference symbol tables_."""

    def alias_table(self) -> Mapping[str, str]: ...

    def instance_types(self) -> Mapping[str, str]: ...

    def property_types(self) -> Mapping[str, str]: ...

    def collection_types(self) -> Mapping[str, str]: ...


class PythonInstanceOwnerContract(Protocol):
    """Responsibilities: _instance owner contract_."""

    def container_name(self, annotation: ast.expr) -> str: ...

    def owner(
        self,
        node: ast.AST,
        owner: str,
        annotation_resolver: PythonAnnotationResolverContract,
    ) -> str: ...


class PythonAnnotatedInstanceBindingsContract(Protocol):
    """Responsibilities: _annotated binding operations_."""

    def collect_function_parameters(
        self,
        current: ast.AST,
        annotation_resolver: PythonAnnotationResolverContract,
        receiver_owner: str,
    ) -> None: ...

    def collect_annotation(
        self,
        current: ast.AnnAssign,
        owner: str,
        annotation_resolver: PythonAnnotationResolverContract,
    ) -> None: ...


class PythonInstanceBindingsContract(Protocol):
    """Responsibilities: _instance binding recording_."""

    def record_for_alias(self, current: ast.AST, owner: str) -> None: ...

    def collect(
        self,
        current: ast.AST,
        owner: str,
        annotation_resolver: PythonAnnotationResolverContract,
        receiver_owner: str = "",
    ) -> None: ...


class PythonScopedOwnerStateContract(Protocol):
    """Responsibilities: _positioned lexical owner records_."""

    def record_at_scope(
        self,
        scope: str,
        name: str,
        owner: str,
        node: ast.AST,
    ) -> None: ...

    def owner_resolution(
        self,
        scopes: list[str],
        name: str,
        node: ast.AST,
    ) -> PythonInstanceWriteLookupContract: ...


class PythonLexicalScopeContract(Protocol):
    """Responsibilities: _lexical scope selection_, _source position ordering_."""

    def scope_chain(self, node: ast.AST) -> list[str]: ...

    def recording_scope(self, node: ast.AST) -> str: ...


class PythonPositionedWriteContract(Protocol):
    """Responsibilities: _source positions_, _owner visibility_."""

    def line_number(self) -> int: ...

    def column_offset(self) -> int: ...

    def owner_name(self) -> str: ...

    def visible_at(self, node: ast.AST) -> bool: ...

    def at_or_after(self, line_number: int, column_offset: int) -> bool: ...


PythonPositionedWrites: TypeAlias = list[PythonPositionedWriteContract]
PythonPositionedWriteMap: TypeAlias = dict[str, PythonPositionedWrites]
PythonScopedOwnerMap: TypeAlias = dict[str, str]


class PythonInstanceWriteLookupContract(Protocol):
    """Responsibilities: _owner candidate state_, _source position ordering_."""

    def with_candidate(
        self,
        write: PythonPositionedWriteContract,
        node: ast.AST,
    ) -> PythonInstanceWriteLookupContract: ...

    def present(self) -> bool: ...

    def owner_name(self) -> str: ...


class PythonCallReturnStateContract(Protocol):
    """Responsibilities: _result ownership contract_."""

    def value(self, key: str) -> str: ...
    def store(self, key: str, owner: str) -> None: ...
    def state_cleanup(self) -> None: ...


class PythonCallReferenceOptionsContract(Protocol):
    """Responsibilities: _call-site reference attribution_."""

    def call_node(self) -> ast.Call: ...
    def caller_owner(self) -> str: ...
    def binding(self) -> PythonCallBindingContract: ...


class PythonCallBindingContract(Protocol):
    """Responsibilities: _call result binding_, _deferred call state_."""

    def function_use(self, callee_name: str) -> JsonObject: ...
    def method_use(
        self,
        receiver_name: str,
        receiver_constructor_name: str,
    ) -> JsonObject: ...


class PythonReferenceBuilderContract(Protocol):
    """Responsibilities: _reference builder operations contract_."""

    def for_call(self, options: PythonCallReferenceOptionsContract) -> JsonObject: ...

    def for_value(self, node: PythonASTLocatedNode, owner: str) -> JsonObject: ...

    def for_expression(self, value: ast.expr, owner: str) -> JsonObject: ...


class PythonCallReturnsContract(Protocol):
    """Responsibilities: _result collection contract_."""

    def return_state(self) -> PythonCallReturnStateContract: ...

    def collect_call_returns(
        self,
        node: ast.AST,
        context: PythonReferenceContextContract,
        owner: str = "",
    ) -> None: ...


class PythonScopedTypeAliasesContract(Protocol):
    """Responsibilities: _scoped type aliases_."""

    def collect(self) -> None: ...

    def resolve(self, name: str, context: PythonASTLocatedNode) -> str: ...
