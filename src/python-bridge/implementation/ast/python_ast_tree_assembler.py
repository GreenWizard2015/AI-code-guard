from __future__ import annotations

from implementation.ast.callables.python_ast_callable_dependencies import (
    PythonAstCallableDependencies,
    PythonAstCallableDependenciesOptions,
)
from implementation.ast.protocols import (
    PythonAstCallableStateContract,
    PythonAstCoreStateContract,
    PythonAstCoreDependenciesContract,
    PythonAstImportStateContract,
    PythonAstTreeStateContract,
)
from implementation.ast.protocols import PythonCallableStatementsContract
from implementation.ast.python_ast_callable_state import PythonAstCallableState
from implementation.ast.python_ast_core_state import PythonAstCoreState
from implementation.ast.python_ast_import_state import PythonAstImportState
from implementation.ast.python_ast_tree_state import PythonAstTreeState
from implementation.references.aliases.python_container_alias_state import (
    PythonContainerAliasState,
)
from implementation.references.aliases.python_container_aliases import (
    PythonContainerAliases,
)
from implementation.references.aliases.python_container_keys import PythonContainerKeys
from implementation.references.aliases.python_container_values import (
    PythonContainerValues,
)
from implementation.references.aliases.python_reference_aliases import (
    PythonReferenceAliases,
)
from implementation.references.protocols import (
    PythonContainerAliasesContract,
    PythonContainerKeysContract,
    PythonContainerValuesContract,
    PythonScopedTypeAliasesContract,
)


class PythonAstTreeAssembler:
    """Responsibilities: _AST dependency assembly_, _analysis state coordination_."""

    _core_dependencies: PythonAstCoreDependenciesContract
    _type_aliases: PythonScopedTypeAliasesContract
    _callable_statements: PythonCallableStatementsContract
    _container_aliases: PythonContainerAliasesContract
    _container_keys: PythonContainerKeysContract
    _container_values: PythonContainerValuesContract

    def _callable_state(
        self, core: PythonAstCoreStateContract
    ) -> PythonAstCallableStateContract:
        """Responsibilities: _callable state assembly_."""
        type_aliases = self._type_aliases
        type_aliases.collect()
        core_dependencies = self._core_dependencies
        dependencies = PythonAstCallableDependencies(
            PythonAstCallableDependenciesOptions(
                tree=core_dependencies.syntax_tree(),
                node_index=core_dependencies.node_index(),
                source_segments=core_dependencies.source_segments(),
                container_aliases=core.container_aliases(),
                type_aliases=type_aliases,
            )
        )
        return PythonAstCallableState(dependencies, self._callable_statements)

    def _import_state(
        self, core: PythonAstCoreStateContract
    ) -> PythonAstImportStateContract:
        """Responsibilities: _import state assembly_."""
        aliases = PythonReferenceAliases()
        return PythonAstImportState(
            core,
            aliases,
            self._core_dependencies.structure_issues(),
        )

    def __init__(
        self,
        core_dependencies: PythonAstCoreDependenciesContract,
        type_aliases: PythonScopedTypeAliasesContract,
        callable_statements: PythonCallableStatementsContract,
    ) -> None:
        """Responsibilities: _AST assembly inputs_."""
        self._core_dependencies: PythonAstCoreDependenciesContract = core_dependencies
        self._type_aliases: PythonScopedTypeAliasesContract = type_aliases
        self._callable_statements: PythonCallableStatementsContract = (
            callable_statements
        )
        alias_state = PythonContainerAliasState()
        self._container_keys: PythonContainerKeysContract = PythonContainerKeys(
            alias_state
        )
        self._container_values: PythonContainerValuesContract = PythonContainerValues(
            alias_state, self._container_keys
        )
        self._container_aliases: PythonContainerAliasesContract = (
            PythonContainerAliases(
                alias_state,
                self._container_keys,
                self._container_values,
                self._core_dependencies.node_index(),
            )
        )

    def core_state(self) -> PythonAstCoreStateContract:
        """Responsibilities: _AST core state assembly_."""
        return PythonAstCoreState(
            self._core_dependencies,
            self._container_aliases,
            self._container_values,
            self._container_keys,
        )

    def state(self, core: PythonAstCoreStateContract) -> PythonAstTreeStateContract:
        """Responsibilities: _AST analysis state assembly_."""
        callables = self._callable_state(core)
        imports = self._import_state(core)
        return PythonAstTreeState(core, callables, imports)
