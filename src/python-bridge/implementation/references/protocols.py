from __future__ import annotations

import ast
from collections.abc import Callable, Mapping
from typing import Protocol, TypeAlias, TYPE_CHECKING

from implementation.types import JsonObject, PythonDecoratorAliasGroups

if TYPE_CHECKING:
    from implementation.ast.protocols import PythonAstNodeIndexContract
    from implementation.protocols import PythonExceptionBroadnessContract

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


PythonPositionedWrites: TypeAlias = list[PythonPositionedWriteContract]
PythonPositionedWriteMap: TypeAlias = dict[str, PythonPositionedWrites]
PythonScopedOwnerMap: TypeAlias = dict[str, str]


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


class PythonContainerAliasStateContract(Protocol):
    """Responsibilities: _container alias lookup state_."""

    def select_scope_node(self, node: ast.AST) -> None: ...

    def static_alias(self, name: str) -> str: ...

    def container_alias(self, name: str) -> dict[str, ast.AST]: ...

    def container_item(self, name: str, key: str) -> PythonContainerLookupContract: ...

    def builtin_dictionary(self, value: ast.AST) -> bool: ...


class PythonScopedTypeAliasesContract(Protocol):
    """Responsibilities: _scoped type aliases_."""

    def collect(self) -> None: ...

    def resolve(self, name: str, context: ast.AST) -> str: ...


class PythonContainerLookupContract(Protocol):
    """Responsibilities: _container lookup result contract_."""

    def found(self) -> bool: ...

    def expression_node(self) -> ast.AST: ...


class PythonContainerAliasesContract(Protocol):
    """Responsibilities: _container alias operations contract_."""

    def container_values(self) -> PythonContainerValuesContract: ...

    def container_keys(self) -> PythonContainerKeysContract: ...

    def clear(self) -> None: ...

    def assign(self, targets: list[ast.AST], value: ast.AST) -> None: ...

    def observe(self, node: ast.AST) -> None: ...

    def observe_all(self, nodes: list[ast.AST], tree: ast.AST) -> None: ...

    def _configure_scope_tree(self, tree: ast.AST) -> None: ...

    def _select_scope_node(self, node: ast.AST) -> None: ...

    def _container_alias(self, name: str) -> dict[str, ast.AST]: ...

    def _is_builtin_dictionary(self, value: ast.AST) -> bool: ...

    def _static_alias(self, name: str) -> str: ...


class PythonContainerAssemblyContract(Protocol):
    """Responsibilities: _container assembly access_."""

    def container_aliases(self) -> PythonContainerAliasesContract: ...

    def container_values(self) -> PythonContainerValuesContract: ...

    def container_keys(self) -> PythonContainerKeysContract: ...


class PythonContainerKeysContract(Protocol):
    """Responsibilities: _static container key contract_."""

    def static_key(self, value: ast.AST) -> str: ...

    def string_value(self, node: ast.AST) -> str: ...


class PythonContainerValuesContract(Protocol):
    """Responsibilities: _container value lookup contract_."""

    def container_value(
        self, value: ast.Subscript
    ) -> PythonContainerLookupContract: ...

    def attribute_value(
        self, value: ast.Attribute
    ) -> PythonContainerLookupContract: ...

    def container_values(self, value: ast.AST) -> list[ast.AST]: ...


class PythonReferenceAliasesContract(Protocol):
    """Responsibilities: _reference alias resolution contract_."""

    def collect(self, tree: ast.Module) -> list[JsonObject]: ...

    def resolved_name(self, name: str, names: frozenset[str]) -> str: ...

    def target_is_class(self, name: str) -> bool: ...

    def target_values(
        self, target: ast.AST, value: ast.AST, references_only: bool = True
    ) -> dict[str, ast.AST]: ...


class PythonScopeAliasHistoryContract(Protocol):
    """Responsibilities: _scoped alias index contract_."""

    def resolve(self, node: ast.AST, name: str, line: int) -> JsonObject: ...


class PythonAssignmentAliasContract(Protocol):
    """Responsibilities: _assignment alias source contract_."""

    def assignment_aliases(self, node: ast.AST) -> dict[str, str]: ...


class PythonProxyTargetContract(Protocol):
    """Responsibilities: _proxy target contract_."""

    def property_decorated(self, node: ast.AST) -> bool: ...

    def supported_target(self, call: ast.Call) -> bool: ...


class PythonProxyReceiverAliasesContract(Protocol):
    """Responsibilities: _proxy receiver alias contract_."""

    def lambda_receiver(self, node: ast.AST) -> bool: ...


class PythonProxyScopeAliasIndexContract(Protocol):
    """Responsibilities: _proxy scope alias lookup_."""

    def value(self, name: str, line: int) -> str: ...

    def resolve(self, name: str, line: int) -> str: ...


class PythonExceptionAliasStateContract(Protocol):
    """Responsibilities: _exception alias state contract_."""

    def observe(self, node: ast.AST) -> None: ...

    def select(self, node: ast.AST) -> None: ...

    def exception_names(self) -> set[str]: ...

    def configure_imports(self, tree: ast.AST) -> None: ...


class PythonExceptionAliasSnapshotContract(Protocol):
    """Responsibilities: _exception aliases_, _builtin module aliases_."""

    def exception_names(self) -> frozenset[str]: ...

    def module_names(self) -> frozenset[str]: ...

    def restore(
        self,
        broadness: PythonExceptionBroadnessContract,
        multi_exception_names: set[str],
    ) -> None: ...


class PythonDynamicTypeReferencesContract(Protocol):
    """Responsibilities: _dynamic type reference resolution_."""

    def reference_name(self, value: ast.AST) -> str: ...

    def module_reference(self, value: ast.AST) -> str: ...

    def type_call_present(self, value: ast.AST) -> bool: ...


class PythonDecoratorAliasesContract(Protocol):
    """Responsibilities: _decorator alias state contract_."""

    def aliases(self) -> PythonDecoratorAliasGroups: ...

    def container_values(self) -> PythonContainerValuesContract: ...


class PythonAssignedDescriptorIndexContract(Protocol):
    """Responsibilities: _assigned descriptor lookup contract_."""

    def collect(self, tree: ast.AST) -> None: ...

    def kind(self, node: ast.AST) -> str: ...


class PythonDecoratorNameContract(Protocol):
    """Responsibilities: _decorator naming contract_."""

    def expression_name(self, value: ast.AST) -> str: ...

    def imported_name(self, imported: ast.alias) -> str: ...


class PythonPrivateVarsMappingContract(Protocol):
    """Responsibilities: _private mapping access contract_."""

    def supports(self, node: ast.AST) -> bool: ...

    def access(self, node: ast.AST, members: set[str]) -> bool: ...


class PythonDecoratorRulesContract(Protocol):
    """Responsibilities: _Python decorator rule contract_."""

    def observe(self, node: ast.AST) -> None: ...

    def kinds(self, node: ast.AST) -> set[str]: ...


class PythonPropertyDecoratorContract(Protocol):
    """Responsibilities: _property decorator classification contract_."""

    def property_decorator(self, decorator: ast.AST) -> bool: ...
