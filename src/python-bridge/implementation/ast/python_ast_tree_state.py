from __future__ import annotations

from implementation.ast.protocols import (
    PythonAstCallableStateContract,
    PythonAstCoreStateContract,
    PythonAstImportStateContract,
    PythonAstTreeDependenciesContract,
)


class PythonAstTreeState:
    """Responsibilities: _AST indexes_, _callable state_."""

    _core: PythonAstCoreStateContract
    _callables: PythonAstCallableStateContract
    _imports: PythonAstImportStateContract
    _tree_dependencies: PythonAstTreeDependenciesContract

    def __init__(
        self,
        core: PythonAstCoreStateContract,
        callables: PythonAstCallableStateContract,
        imports: PythonAstImportStateContract,
        tree_dependencies: PythonAstTreeDependenciesContract,
    ) -> None:
        """Responsibilities: _AST state ownership_."""
        self._core: PythonAstCoreStateContract = core
        self._callables: PythonAstCallableStateContract = callables
        self._imports: PythonAstImportStateContract = imports
        self._tree_dependencies: PythonAstTreeDependenciesContract = tree_dependencies

    def core(self) -> PythonAstCoreStateContract:
        """Responsibilities: _core state access_."""
        return self._core

    def callables(self) -> PythonAstCallableStateContract:
        """Responsibilities: _callable state access_."""
        return self._callables

    def imports(self) -> PythonAstImportStateContract:
        """Responsibilities: _import state access_."""
        return self._imports

    def tree_dependencies(self) -> PythonAstTreeDependenciesContract:
        """Responsibilities: _tree analysis access_."""
        return self._tree_dependencies
