from __future__ import annotations

import ast
from typing import Protocol

from implementation.types import JsonObject


class PythonAnnotationResolverProtocol(Protocol):
    """Responsibilities: _annotation name resolution contract_."""

    def annotation_name(
        self,
        annotation: ast.AST,
        aliases: dict[str, str],
        generics: frozenset[str],
    ) -> str: ...


class PythonReferenceContextProtocol(Protocol):
    """Responsibilities: _reference context state contract_."""

    def annotation_aliases(self) -> dict[str, str]: ...

    def attribute_owner(self, value: ast.AST, current_owner: str) -> str: ...

    def call_return_owner(
        self, function: ast.AST, fallback_to_name: bool = False
    ) -> str: ...

    def instance_owner(self, name: str) -> str: ...

    def record_instance(self, name: str, owner: str) -> None: ...

    def property_owner(self, key: str) -> str: ...

    def record_property(self, key: str, owner: str) -> None: ...


class PythonCallReturnStateProtocol(Protocol):
    """Responsibilities: _callable return ownership_."""

    def value(self, key: str) -> str: ...
    def store(self, key: str, owner: str) -> None: ...
    def state_cleanup(self) -> None: ...


class PythonReferenceBuilderProtocol(Protocol):
    """Responsibilities: _reference builder operations contract_."""

    def for_call(self, node: ast.Call, owner: str) -> JsonObject: ...

    def for_value(self, node: ast.AST, owner: str) -> JsonObject: ...

    def for_expression(self, value: ast.AST, line: int, owner: str) -> JsonObject: ...


class PythonCallReturnsProtocol(Protocol):
    """Responsibilities: _callable return collection_."""

    def return_state(self) -> PythonCallReturnStateProtocol: ...

    def collect_call_returns(
        self,
        node: ast.AST,
        context: PythonReferenceContextProtocol,
        owner: str = "",
    ) -> None: ...
