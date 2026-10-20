from __future__ import annotations

from implementation.ast.protocols import (
    PythonAstCallableStateContract,
    PythonAstCoreStateContract,
    PythonAstImportStateContract,
)


class PythonAstTreeState:
    """Responsibilities: _AST indexes_, _callable state_."""

    _core: PythonAstCoreStateContract
    _callables: PythonAstCallableStateContract
    _imports: PythonAstImportStateContract

    def __init__(
        self,
        core: PythonAstCoreStateContract,
        callables: PythonAstCallableStateContract,
        imports: PythonAstImportStateContract,
    ) -> None:
        """Responsibilities: _AST state ownership_."""
        self._core: PythonAstCoreStateContract = core
        self._callables: PythonAstCallableStateContract = callables
        self._imports: PythonAstImportStateContract = imports

    def core(self) -> PythonAstCoreStateContract:
        """Responsibilities: _core state access_."""
        return self._core

    def callables(self) -> PythonAstCallableStateContract:
        """Responsibilities: _callable state access_."""
        return self._callables

    def imports(self) -> PythonAstImportStateContract:
        """Responsibilities: _import state access_."""
        return self._imports
