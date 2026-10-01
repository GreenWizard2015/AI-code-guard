from __future__ import annotations

import ast
from typing import Protocol
from implementation.types import JsonObject


class PythonContainerLookupProtocol(Protocol):
    """Responsibilities: _container lookup result contract_."""

    def found(self) -> bool: ...

    def expression_node(self) -> ast.AST: ...


class PythonContainerAliasesProtocol(Protocol):
    """Responsibilities: _container alias operations contract_."""

    def clear(self) -> None:
        """Responsibilities: _container alias state reset_."""
        ...

    def assign(self, targets: list[ast.AST], value: ast.AST) -> None:
        """Responsibilities: _container alias assignment tracking_."""
        ...

    def observe(self, node: ast.AST) -> None:
        """Responsibilities: _container assignment observation_."""
        ...

    def observe_all(self, nodes: list[ast.AST]) -> None:
        """Responsibilities: _container assignment batch observation_."""
        ...

    def _is_builtin_dictionary(self, value: ast.AST) -> bool: ...

    def static_alias(self, name: str) -> str: ...


class PythonContainerValuesProtocol(Protocol):
    """Responsibilities: _container value lookup contract_."""

    def container_value(
        self, value: ast.Subscript
    ) -> PythonContainerLookupProtocol: ...

    def attribute_value(
        self, value: ast.Attribute
    ) -> PythonContainerLookupProtocol: ...

    def container_result(
        self, found: bool, expression: ast.AST
    ) -> PythonContainerLookupProtocol: ...


class PythonReferenceAliasesProtocol(Protocol):
    """Responsibilities: _reference alias resolution contract_."""

    def collect(self, tree: ast.Module) -> list[JsonObject]: ...

    def resolved_name(self, name: str, names: frozenset[str]) -> str: ...
