from __future__ import annotations

from implementation.ast.protocols import PythonAstCoreDependenciesContract
from implementation.references.protocols import (
    PythonContainerAliasesContract,
    PythonContainerKeysContract,
    PythonContainerValuesContract,
)


class PythonAstCoreState:
    """Responsibilities: _AST source_, _core parser dependencies_."""

    _dependencies: PythonAstCoreDependenciesContract
    _container_aliases: PythonContainerAliasesContract
    _container_values: PythonContainerValuesContract
    _container_keys: PythonContainerKeysContract

    def __init__(
        self,
        dependencies: PythonAstCoreDependenciesContract,
        container_aliases: PythonContainerAliasesContract,
        container_values: PythonContainerValuesContract,
        container_keys: PythonContainerKeysContract,
    ) -> None:
        """Responsibilities: _AST core state initialization_."""
        self._dependencies: PythonAstCoreDependenciesContract = dependencies
        self._container_aliases: PythonContainerAliasesContract = container_aliases
        self._container_values: PythonContainerValuesContract = container_values
        self._container_keys: PythonContainerKeysContract = container_keys

    def source_dependencies(self) -> PythonAstCoreDependenciesContract:
        """Responsibilities: _source dependency access_."""
        return self._dependencies

    def container_aliases(self) -> PythonContainerAliasesContract:
        """Responsibilities: _container alias access_."""
        return self._container_aliases

    def container_values(self) -> PythonContainerValuesContract:
        """Responsibilities: _container value access_."""
        return self._container_values

    def container_keys(self) -> PythonContainerKeysContract:
        """Responsibilities: _container key access_."""
        return self._container_keys
