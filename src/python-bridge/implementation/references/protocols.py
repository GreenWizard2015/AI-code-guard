from __future__ import annotations

import ast
from collections.abc import Callable, Mapping
from typing import Protocol

from implementation.protocols import PythonAstNodeIndexContract
from implementation.types import JsonObject

PythonReferenceOperation = Callable[[], None]


class PythonAnnotationResolverContract(Protocol):
    """Responsibilities: _annotation name resolution contract_."""

    def annotation_name(
        self,
        annotation: ast.AST,
        aliases: dict[str, str],
        generics: frozenset[str],
    ) -> str:
        raise NotImplementedError(generics)


class PythonReferenceContextContract(Protocol):
    """Responsibilities: _reference context state contract_."""

    def reference_ownership(self) -> PythonReferenceOwnershipContract: ...

    def attribute_owner(self, value: ast.AST, current_owner: str) -> str: ...

    def collection_element_owner(self, value: ast.AST, current_owner: str) -> str: ...


class PythonReferenceOwnershipContract(Protocol):
    """Responsibilities: _reference binding state_, _lexical owner lookup_."""

    def instance_owner(self, name: str, node: ast.AST) -> str: ...

    def _property_owner(self, owner: str, property_name: str, node: ast.AST) -> str: ...

    def name_resolver(self) -> PythonReferenceNameResolverContract: ...

    def _record_property_type(self, name: str, owner: str, node: ast.AST) -> None: ...

    def record_binding(
        self,
        name: str,
        owner: str,
        collection_owner: str,
        node: ast.AST,
    ) -> None: ...

    def _record_annotation(self, name: str, owner: str, node: ast.AST) -> None: ...

    def _record_element_annotation(
        self, name: str, owner: str, node: ast.AST
    ) -> None: ...

    def _record_property(
        self, owner: str, property_name: str, value: str, node: ast.AST
    ) -> None: ...

    def _collection_element_owner(self, name: str, node: ast.AST) -> str: ...

    def _children(self, node: ast.AST) -> list[ast.AST]: ...

    def _instance_binding_present(self, name: str, node: ast.AST) -> bool: ...


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
        annotation: ast.AST,
        generics: frozenset[str],
    ) -> str: ...

    def callable_key(self, node: ast.AST) -> str: ...

    def call_return_owner(
        self, function: ast.AST, node: ast.AST, fallback_to_name: bool
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


class PythonCollectionElementOwnerContract(Protocol):
    """Responsibilities: _collection element owner contract_."""

    def owner(self, value: ast.AST, current_owner: str) -> str: ...


class PythonScopedOwnerStateContract(Protocol):
    """Responsibilities: _positioned lexical owner records_."""

    def record_at_scope(
        self, scope: str, name: str, owner: str, node: ast.AST
    ) -> None: ...

    def annotate_at_scope(
        self, scope: str, name: str, owner: str, node: ast.AST
    ) -> None: ...

    def owner_at_scopes(self, scopes: list[str], name: str, node: ast.AST) -> str: ...

    def binding_present(self, scopes: list[str], name: str) -> bool: ...


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


class PythonInstanceWriteLookupContract(Protocol):
    """Responsibilities: _owner candidate state_, _source position ordering_."""

    def present(self) -> bool: ...

    def owner_name(self) -> str: ...


class PythonCallReturnStateContract(Protocol):
    """Responsibilities: _result ownership contract_."""

    def value(self, key: str) -> str: ...
    def store(self, key: str, owner: str) -> None: ...
    def state_cleanup(self) -> None: ...


class PythonReferenceBuilderContract(Protocol):
    """Responsibilities: _reference builder operations contract_."""

    def for_call(self, node: ast.Call, owner: str) -> JsonObject: ...

    def for_value(self, node: ast.AST, owner: str) -> JsonObject: ...

    def for_expression(self, value: ast.AST, line: int, owner: str) -> JsonObject: ...


class PythonCallReturnsContract(Protocol):
    """Responsibilities: _result collection contract_."""

    def return_state(self) -> PythonCallReturnStateContract: ...

    def collect_call_returns(
        self,
        node: ast.AST,
        context: PythonReferenceContextContract,
        owner: str = "",
    ) -> None: ...
