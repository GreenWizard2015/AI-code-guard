from __future__ import annotations

import ast
from typing import Protocol


class PythonDynamicImportReferenceContract(Protocol):
    """Responsibilities: _dynamic import reference contract_."""

    def kind_value(self) -> str: ...

    def name_value(self) -> str: ...

    def resolved(self) -> bool: ...


class PythonDynamicImportNamesContract(Protocol):
    """Responsibilities: _dynamic import names contract_."""

    def configure(self) -> None: ...

    def observe(self, node: ast.AST) -> None: ...

    def matches(self, function: ast.AST) -> bool: ...


class PythonDynamicImportReferenceResolverContract(Protocol):
    """Responsibilities: _dynamic module reference_."""

    def reference(
        self,
        expression: ast.AST,
    ) -> PythonDynamicImportReferenceContract: ...


class PythonDynamicImportSubscriptOwnerContract(Protocol):
    """Responsibilities: _dynamic import subscript owner_."""

    @property
    def module(self) -> str: ...

    @property
    def name(self) -> str: ...


class PythonDynamicImportCallTargetContract(Protocol):
    """Responsibilities: _dynamic import target_."""

    @property
    def reference(self) -> PythonDynamicImportReferenceContract: ...

    @property
    def name(self) -> str: ...
