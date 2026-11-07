from __future__ import annotations

import ast
from collections.abc import Set as AbstractSet
from typing import TYPE_CHECKING, Protocol

from implementation.types import PythonDecoratorAliasGroups

if TYPE_CHECKING:
    from implementation.references.protocols import PythonContainerValuesContract


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

    def access(self, node: ast.AST, members: AbstractSet[str]) -> bool: ...


class PythonDecoratorRulesContract(Protocol):
    """Responsibilities: _Python decorator rule contract_."""

    def observe(self, node: ast.AST) -> None: ...

    def kinds(self, node: ast.AST) -> set[str]: ...


class PythonPropertyDecoratorContract(Protocol):
    """Responsibilities: _property decorator classification contract_."""

    def property_decorator(self, decorator: ast.AST) -> bool: ...
