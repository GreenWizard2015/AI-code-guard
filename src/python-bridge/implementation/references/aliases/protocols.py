from __future__ import annotations

import ast
from typing import Protocol

from implementation.types import JsonObject


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

    def clear(self) -> None:
        """Responsibilities: _container alias state reset_."""
        ...

    def assign(self, targets: list[ast.AST], value: ast.AST) -> None:
        """Responsibilities: _container alias assignment tracking_."""
        ...

    def observe(self, node: ast.AST) -> None:
        """Responsibilities: _container assignment observation_."""
        ...

    def observe_all(self, nodes: list[ast.AST], tree: ast.AST) -> None:
        """Responsibilities: _container assignment batch observation_."""
        ...

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
