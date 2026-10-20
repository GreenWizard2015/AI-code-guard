from __future__ import annotations

import ast

from typing import Protocol

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from implementation.ast.protocols import (
        PythonAstNodeIndexContract,
    )
    from implementation.types import (
        JsonObject,
    )
    from implementation.references.protocols import (
        PythonExceptionAliasSnapshotContract,
        PythonExceptionAliasStateContract,
        PythonReferenceAliasesContract,
    )
    from implementation.rules.protocols import (
        PythonExceptionRulesContract,
    )
    from implementation.rules.protocols import (
        PythonDynamicTypeRulesContract,
    )


class PythonProxyCallableAnalyzerContract(Protocol):
    """Responsibilities: _proxy callable analysis_."""

    def analyze(self, node: ast.AST) -> list[JsonObject]: ...


class PythonPrivateAccessClassifierContract(Protocol):
    """Responsibilities: _classification external private access_."""

    def private_access(self, node: ast.AST, members: set[str]) -> bool: ...

    def attribute_lines(self, node: ast.AST, members: set[str]) -> set[int]: ...


class PythonPrimaryTypeStateContract(Protocol):
    """Responsibilities: _primary type state access_."""

    def type_factory_names(self) -> PythonTypeFactoryNamesContract: ...
    def dynamic_rules(self) -> PythonDynamicTypeRulesContract: ...
    def exception_aliases(self) -> PythonExceptionAliasStateContract: ...
    def exception_rules(self) -> PythonExceptionRulesContract: ...


class PythonReflectionNamesContract(Protocol):
    """Responsibilities: _reflection names contract_."""

    def access_name(self, function: ast.AST) -> str: ...

    def name(self, function: ast.AST) -> str: ...


class PythonCallClassificationContract(Protocol):
    """Responsibilities: _invocation category_."""

    def configure(
        self, tree: ast.AST, node_index: PythonAstNodeIndexContract
    ) -> None: ...

    def kind(self, node: ast.AST) -> str: ...

    def test_function(self, node: ast.AST) -> bool: ...

    def contains_callable_condition(self, node: ast.Call) -> bool: ...


class PythonTemporaryResultAccessContract(Protocol):
    """Responsibilities: _temporary result access policy_."""

    def constructor_result(self, target: ast.AST) -> bool: ...

    def violates(self, node: ast.AST) -> bool: ...


class PythonCallAliasStateContract(Protocol):
    """Responsibilities: _alias state_."""

    def observe(self, node: ast.AST) -> None: ...

    def observe_all(self, nodes: list[ast.AST], tree: ast.AST) -> None: ...

    def container_value(self, value: ast.Subscript) -> JsonObject: ...

    def named_value(self, name: str) -> JsonObject: ...


class PythonTypeFactoryNamesContract(Protocol):
    """Responsibilities: _Python type-name resolution contract_."""

    def configure(self, tree: ast.AST) -> None: ...

    def _observe(self, node: ast.AST) -> None: ...

    def matches(self, value: ast.AST) -> bool: ...

    def configure_tuple(self, tree: ast.AST) -> None: ...

    def _observe_tuple(self, node: ast.AST) -> None: ...

    def tuple_annotation(self, value: ast.AST) -> bool: ...


class PythonExceptionMultiplicityContract(Protocol):
    """Responsibilities: _exception multiplicity contract_."""

    def configure(self, targets: list[ast.AST], value: ast.AST) -> None: ...

    def names(self) -> set[str]: ...

    def aliases(self) -> PythonReferenceAliasesContract: ...

    def matches(self, source: ast.AST) -> bool: ...


class PythonExceptionBroadnessContract(Protocol):
    """Responsibilities: _broad exception contract_."""

    def snapshot(
        self, multi_names: frozenset[str]
    ) -> PythonExceptionAliasSnapshotContract: ...

    def restore_snapshot(
        self, snapshot: PythonExceptionAliasSnapshotContract
    ) -> None: ...

    def observe_alias(self, source: str, target: str, broad: bool = False) -> None: ...

    def broad(self, node: ast.AST) -> bool: ...

    def observe(self, node: ast.AST) -> None: ...
