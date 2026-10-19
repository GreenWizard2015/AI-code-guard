from __future__ import annotations

from implementation.ast.callables.python_ast_callable_dependencies import (
    PythonAstCallableDependencies,
)
from implementation.ast.protocols import (
    PythonAstCallableStateContract,
    PythonAstCoreDependenciesContract,
    PythonAstCoreStateContract,
    PythonAstImportStateContract,
    PythonAstTreeDependenciesContract,
)
from implementation.ast.python_ast_callable_state import PythonAstCallableState
from implementation.ast.python_ast_core_state import PythonAstCoreState
from implementation.ast.python_ast_import_state import PythonAstImportState
from implementation.references.aliases.protocols import (
    PythonContainerAssemblyContract,
    PythonReferenceAliasesContract,
)
from implementation.references.aliases.python_reference_aliases import (
    PythonReferenceAliases,
)


class PythonAstTreeState:
    """Responsibilities: _AST indexes_, _callable state_."""

    _core: PythonAstCoreStateContract
    _callables: PythonAstCallableStateContract
    _imports: PythonAstImportStateContract

    def __init__(
        self,
        core_dependencies: PythonAstCoreDependenciesContract,
        tree_dependencies: PythonAstTreeDependenciesContract,
        container_assembly: PythonContainerAssemblyContract,
    ) -> None:
        """Responsibilities: _AST analysis state initialization_."""
        reference_aliases: PythonReferenceAliasesContract = PythonReferenceAliases()
        self._core: PythonAstCoreStateContract = PythonAstCoreState(
            core_dependencies,
            container_assembly.container_aliases(),
            container_assembly.container_values(),
            container_assembly.container_keys(),
        )
        source_dependencies = core_dependencies
        callable_dependencies = PythonAstCallableDependencies(
            source_dependencies.syntax_tree(),
            source_dependencies.node_index(),
            source_dependencies.source_segments(),
            self._core.container_aliases(),
        )
        self._callables: PythonAstCallableStateContract = PythonAstCallableState(
            callable_dependencies,
            tree_dependencies.callable_statements(),
        )
        self._imports: PythonAstImportStateContract = PythonAstImportState(
            container_assembly.import_options(
                self._core,
                reference_aliases,
                core_dependencies.structure_issues(),
            )
        )

    def core(self) -> PythonAstCoreStateContract:
        """Responsibilities: _core state access_."""
        return self._core

    def callables(self) -> PythonAstCallableStateContract:
        """Responsibilities: _callable state access_."""
        return self._callables

    def imports(self) -> PythonAstImportStateContract:
        """Responsibilities: _import state access_."""
        return self._imports
