from __future__ import annotations

import ast
from typing import Protocol

from implementation.ast.protocols import PythonAstNodeIndexContract
from implementation.protocols import PythonReflectionNamesContract
from implementation.references.decorator_protocols import (
    PythonPrivateVarsMappingContract,
)
from implementation.references.protocols import (
    PythonContainerAliasesContract,
    PythonContainerKeysContract,
)
from implementation.types import JsonObject


class PythonPrivateAccessOptionsContract(Protocol):
    """Responsibilities: _private access analysis dependencies_."""

    @property
    def tree(self) -> ast.Module: ...

    @property
    def node_index(self) -> PythonAstNodeIndexContract: ...

    @property
    def container_aliases(self) -> PythonContainerAliasesContract: ...

    @property
    def container_keys(self) -> PythonContainerKeysContract: ...

    @property
    def reflection_names(self) -> PythonReflectionNamesContract: ...

    @property
    def private_vars_mapping(self) -> PythonPrivateVarsMappingContract: ...


class PythonPrivateAccessCollectorContract(Protocol):
    """Responsibilities: _private member access_."""

    def member_names(self) -> set[str]: ...

    def accesses(self, members: set[str]) -> list[JsonObject]: ...
