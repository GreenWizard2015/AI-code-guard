from __future__ import annotations

import ast
from typing import TYPE_CHECKING, Protocol

if TYPE_CHECKING:
    from implementation.references.protocols import (
        PythonContainerLookupContract,
        PythonExceptionAliasSnapshotContract,
        PythonExceptionAliasStateContract,
        PythonReferenceAliasesContract,
    )
    from implementation.rules.protocols import (
        PythonDynamicTypeRulesContract,
        PythonExceptionRulesContract,
    )
    from implementation.types import (
        JsonObject,
    )


class PythonProxyCallableAnalyzerContract(Protocol):
    """Responsibilities: _proxy callable analysis_."""

    def analyze(self, node: ast.AST) -> list[JsonObject]: ...


class PythonProxyCallableSyntaxContract(Protocol):
    """Responsibilities: _proxy callable syntax analysis_."""

    def property_decorated(self, callable_definition: ast.AST) -> bool: ...

    def supported_target(self, invocation: ast.Call) -> bool: ...

    def owned_collection_mutation(
        self,
        callable_definition: ast.AST,
        mutation_call: ast.Call,
    ) -> bool: ...

    def proxy_call(self, callable_definition: ast.AST) -> bool: ...

    def proxy_lambda(self, lambda_expression: ast.AST) -> bool: ...


class PythonLiteralVariantIndexContract(Protocol):
    """Responsibilities: _Literal import resolution_, _Literal alias registration_."""

    def prepare_imports(self, tree: ast.Module) -> None: ...

    def append_alias(self, node: ast.AST) -> None: ...


class PythonEnumVariantIndexContract(Protocol):
    """Responsibilities: _enum base import resolution_, _enum declaration registration_."""

    def prepare_imports(self, tree: ast.Module) -> None: ...

    def append_declaration(self, node: ast.AST) -> None: ...


class PythonFiniteVariantContract(Protocol):
    """Responsibilities: _finite variant definition_."""

    def supports(self) -> bool: ...

    def members(self) -> set[str]: ...

    def discriminant(self) -> str: ...

    def member_present(self, member: str) -> bool: ...

    def member_count(self) -> int: ...


class PythonFiniteVariantIndexContract(Protocol):
    """Responsibilities: _finite variant lookup_."""

    def variant(self, name: str) -> PythonFiniteVariantContract: ...


class PythonPrivateAccessClassifierContract(Protocol):
    """Responsibilities: _classification external private access_."""

    def private_access(self, node: ast.AST) -> bool: ...

    def attribute_lines(self, node: ast.AST) -> set[int]: ...


class PythonPrimaryTypeStateContract(Protocol):
    """Responsibilities: _primary type state access_."""

    def type_factory_names(self) -> PythonTypeFactoryNamesContract: ...
    def tuple_type_names(self) -> PythonTupleTypeNamesContract: ...
    def dynamic_rules(self) -> PythonDynamicTypeRulesContract: ...
    def exception_aliases(self) -> PythonExceptionAliasStateContract: ...
    def exception_rules(self) -> PythonExceptionRulesContract: ...


class PythonReflectionNamesContract(Protocol):
    """Responsibilities: _reflection names contract_."""

    def resolve(self, function: ast.AST, names: frozenset[str]) -> str: ...


class PythonCallClassificationContract(Protocol):
    """Responsibilities: _invocation category_."""

    def kind(self, node: ast.AST) -> str: ...

    def resolved_kind(self, invocation: ast.Call, function: ast.AST) -> str: ...


class PythonTemporaryResultAccessContract(Protocol):
    """Responsibilities: _temporary result access policy_."""

    def constructor_result(self, target: ast.AST) -> bool: ...

    def violates(self, node: ast.expr) -> bool: ...


class PythonCallAliasStateContract(Protocol):
    """Responsibilities: _alias state_."""

    def observe(self, node: ast.AST) -> None: ...

    def observe_all(self, nodes: list[ast.AST]) -> None: ...

    def container_value(
        self,
        value: ast.Subscript,
    ) -> PythonContainerLookupContract: ...

    def named_value(self, name: str) -> PythonContainerLookupContract: ...


class PythonCallReflectionIndexContract(Protocol):
    """Responsibilities: _reflection alias indexing_."""

    def configure(self, tree: ast.AST, nodes: list[ast.AST]) -> None: ...

    def resolve(self, function: ast.AST) -> str: ...


class PythonTypeFactoryNamesContract(Protocol):
    """Responsibilities: _Python type-name resolution contract_."""

    def configure(self, tree: ast.AST) -> None: ...

    def observe(self, node: ast.AST) -> None: ...

    def matches(self, value: ast.AST) -> bool: ...


class PythonTupleTypeNamesContract(Protocol):
    """Responsibilities: _tuple type alias lookup_."""

    def configure(self, tree: ast.AST) -> None: ...

    def observe(self, node: ast.AST) -> None: ...

    def annotation(self, value: ast.AST) -> bool: ...


class PythonExceptionMultiplicityContract(Protocol):
    """Responsibilities: _exception multiplicity contract_."""

    def configure(self, targets: list[ast.AST], value: ast.AST) -> None: ...

    def names(self) -> set[str]: ...

    def restore_names(self, names: set[str]) -> None: ...

    def aliases(self) -> PythonReferenceAliasesContract: ...

    def matches(self, source: ast.AST) -> bool: ...


class PythonExceptionBroadnessContract(Protocol):
    """Responsibilities: _broad exception contract_."""

    def snapshot(
        self,
        multi_names: frozenset[str],
    ) -> PythonExceptionAliasSnapshotContract: ...

    def restore_snapshot(
        self,
        snapshot: PythonExceptionAliasSnapshotContract,
    ) -> None: ...

    def observe_alias(self, source: str, target: str, broad: bool = False) -> None: ...

    def broad(self, node: ast.AST) -> bool: ...

    def observe(self, node: ast.AST) -> None: ...
