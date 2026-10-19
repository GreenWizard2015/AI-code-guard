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

    def configure(self, tree: ast.AST) -> None: ...

    def observe(self, node: ast.AST) -> None: ...

    def matches(self, function: ast.AST) -> bool: ...


class PythonDynamicImportReferenceResolverContract(Protocol):
    """Responsibilities: _dynamic module reference_."""

    def reference(
        self, value: ast.AST, seen: set[int]
    ) -> PythonDynamicImportReferenceContract: ...


class PythonDynamicImportSubscriptOwnerContract(Protocol):
    """Responsibilities: _dynamic import subscript owner_."""

    def module_value(self) -> str: ...

    def name_value(self) -> str: ...


class PythonDynamicImportCallTargetContract(Protocol):
    """Responsibilities: _dynamic import target_."""

    def reference_value(self) -> PythonDynamicImportReferenceContract: ...

    def name_value(self) -> str: ...
