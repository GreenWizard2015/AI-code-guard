from __future__ import annotations

from implementation.ast.protocols import PythonAstCallableDependenciesContract
from implementation.protocols import (
    PythonAstSymbolNodesContract,
    PythonCallableStatementsContract,
    PythonFunctionNodesContract,
)


class PythonAstCallableState:
    """Responsibilities: _AST callable_, _symbol state_."""

    _function_nodes: PythonFunctionNodesContract
    _symbols: PythonAstSymbolNodesContract
    _callable_statements: PythonCallableStatementsContract

    def __init__(
        self,
        dependencies: PythonAstCallableDependenciesContract,
        callable_statements: PythonCallableStatementsContract,
    ) -> None:
        """Responsibilities: _callable state initialization_."""
        self._function_nodes: PythonFunctionNodesContract = (
            dependencies.function_nodes()
        )
        self._symbols: PythonAstSymbolNodesContract = dependencies.symbols()
        self._callable_statements: PythonCallableStatementsContract = (
            callable_statements
        )

    def function_nodes(self) -> PythonFunctionNodesContract:
        """Responsibilities: _function node access_."""
        return self._function_nodes

    def symbols(self) -> PythonAstSymbolNodesContract:
        """Responsibilities: _symbol access_."""
        return self._symbols

    def callable_statements(self) -> PythonCallableStatementsContract:
        """Responsibilities: _callable statement access_."""
        return self._callable_statements
