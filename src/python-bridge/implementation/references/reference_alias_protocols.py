from __future__ import annotations

import ast
from typing import TYPE_CHECKING, Protocol

from implementation.references.alias_types import (
    AssignmentAliasCache,
    ContainerItemMap,
    ExpandedContainerValues,
    TreeAliasCache,
)
from implementation.types import JsonObject

if TYPE_CHECKING:
    from implementation.ast.protocols import PythonAstNodeIndexContract
    from implementation.protocols import PythonExceptionBroadnessContract


class PythonContainerLookupContract(Protocol):
    """Responsibilities: _container lookup result contract_."""

    def found(self) -> bool: ...

    def expression_node(self) -> ast.AST: ...

    def expression_or(self, fallback: ast.AST) -> ast.AST: ...


class PythonContainerItemRequestContract(Protocol):
    """Responsibilities: _container item request_."""

    @property
    def expression(self) -> ast.AST: ...

    @property
    def key(self) -> str: ...


class PythonContainerAliasContract(Protocol):
    """Responsibilities: _named container alias snapshot_."""

    def static_value(self) -> str: ...

    def values(self) -> ContainerItemMap: ...

    def item(self, key: str) -> PythonContainerLookupContract: ...


class PythonContainerAliasStateContract(Protocol):
    """Responsibilities: _container alias lookup state_."""

    def node_index(self) -> PythonAstNodeIndexContract: ...

    def select_scope_node(self, node: ast.AST) -> None: ...

    def configure_scope_tree(self, tree: ast.AST) -> None: ...

    def record_alias(
        self,
        container_alias_name: str,
        static_value: str,
        values: ContainerItemMap,
    ) -> None: ...

    def clear(self) -> None: ...

    def alias(self, lookup_name: str) -> PythonContainerAliasContract: ...


class PythonContainerAliasesContract(Protocol):
    """Responsibilities: _container alias operations contract_."""

    def state(self) -> PythonContainerAliasStateContract: ...

    def container_values(self) -> PythonContainerValuesContract: ...

    def container_keys(self) -> PythonContainerKeysContract: ...

    def clear(self) -> None: ...

    def observe(self, node: ast.AST) -> None: ...

    def observe_all(self, nodes: list[ast.AST], tree: ast.AST) -> None: ...


class PythonContainerAssemblyContract(Protocol):
    """Responsibilities: _container assembly access_."""

    def container_aliases(self) -> PythonContainerAliasesContract: ...

    def container_values(self) -> PythonContainerValuesContract: ...

    def container_keys(self) -> PythonContainerKeysContract: ...


class PythonContainerKeysContract(Protocol):
    """Responsibilities: _static container key contract_."""

    def static_key(self, value: ast.AST) -> str: ...

    def string_value(self, node: ast.AST) -> str: ...


class PythonContainerItemsContract(Protocol):
    """Responsibilities: _static container item operations_."""

    def items(self, expression: ast.AST) -> ContainerItemMap: ...

    def item(self, container: ast.AST, key: str) -> PythonContainerLookupContract: ...

    def builtin_item(
        self,
        dictionary: ast.AST,
        key: str,
    ) -> PythonContainerLookupContract: ...

    def reset(self) -> None: ...

    def observe_builtin_aliases(self, node: ast.AST) -> None: ...


class PythonContainerValuesContract(Protocol):
    """Responsibilities: _container value lookup contract_."""

    def container_value(
        self,
        value: ast.Subscript,
    ) -> PythonContainerLookupContract: ...

    def attribute_value(
        self,
        value: ast.Attribute,
    ) -> PythonContainerLookupContract: ...

    def container_values(self, value: ast.AST) -> ExpandedContainerValues: ...


class PythonReferenceAliasStateContract(Protocol):
    """Responsibilities: _alias collection state_, _alias lookup indexes_."""

    @property
    def aliases(self) -> list[JsonObject]: ...

    @property
    def alias_index(self) -> dict[str, str]: ...

    @property
    def resolved_aliases(self) -> dict[str, str]: ...

    @property
    def assignment_cache(self) -> AssignmentAliasCache: ...

    @property
    def tree_cache(self) -> TreeAliasCache: ...


class PythonReferenceAliasesContract(Protocol):
    """Responsibilities: _reference alias resolution contract_."""

    def collect(self, tree: ast.Module, nodes: list[ast.AST]) -> list[JsonObject]: ...

    def resolved_name(self, name: str, names: frozenset[str]) -> str: ...

    def target_name(self, name: str) -> str: ...

    def target_values(
        self,
        target: ast.AST,
        value: ast.AST,
        references_only: bool = True,
    ) -> dict[str, ast.AST]: ...


class PythonScopeAliasHistoryContract(Protocol):
    """Responsibilities: _scoped alias index contract_."""

    def resolve(self, node: ast.AST, name: str, line: int) -> JsonObject: ...


class PythonAssignmentAliasContract(Protocol):
    """Responsibilities: _assignment alias source contract_."""

    def assignment_aliases(self, node: ast.AST) -> dict[str, str]: ...


class PythonProxyReceiverAliasesContract(Protocol):
    """Responsibilities: _proxy receiver alias contract_."""

    def lambda_receiver(self, node: ast.AST) -> bool: ...


class PythonProxyScopeAliasIndexContract(Protocol):
    """Responsibilities: _line-scoped proxy alias lookup_."""

    def value(self, name: str, line: int) -> str: ...

    def resolve(self, name: str, line: int) -> str: ...


class PythonExceptionAliasStateContract(Protocol):
    """Responsibilities: _exception alias state contract_."""

    def observe(self, node: ast.AST) -> None: ...

    def select(self, node: ast.AST) -> None: ...

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
