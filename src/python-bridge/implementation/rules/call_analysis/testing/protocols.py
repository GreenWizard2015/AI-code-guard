from __future__ import annotations

import ast
from typing import Protocol

from implementation.ast.protocols import PythonCallableConditionContextContract
from implementation.types import JsonObject


class PythonAsyncModuleNameStateContract(Protocol):
    """Responsibilities: _module async name lifecycle_."""

    def prepare(self, tree: ast.Module) -> None: ...

    def snapshot(self) -> set[str]: ...


class PythonTestExecutionRegionContract(Protocol):
    """Responsibilities: _test execution region access_."""

    @property
    def nodes(self) -> list[ast.AST]: ...

    def local_names(self) -> set[str]: ...


class PythonTestTimeDependencyContract(Protocol):
    """Responsibilities: _test time dependency analysis_."""

    def issue(
        self,
        node: ast.Call,
        classification: PythonCallableConditionContextContract,
    ) -> list[JsonObject]: ...
