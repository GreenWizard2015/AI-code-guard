from __future__ import annotations

from implementation.ast.imports.python_ast_import_state_options import (
    PythonAstImportStateOptions,
)
from implementation.ast.protocols import (
    PythonAstCoreStateContract,
    PythonAstImportStateOptionsContract,
)
from implementation.protocols import (
    PythonAstNodeIndexContract,
    PythonStructureIssuesContract,
)
from implementation.references.aliases.protocols import (
    PythonContainerAliasesContract,
    PythonContainerKeysContract,
    PythonContainerValuesContract,
    PythonReferenceAliasesContract,
)
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


class PythonContainerAssembly:
    """Responsibilities: _container analyzer composition_, _import option configuration_."""

    aliases: PythonContainerAliasesContract
    values: PythonContainerValuesContract
    keys: PythonContainerKeysContract

    def __init__(self, node_index: PythonAstNodeIndexContract) -> None:
        """Responsibilities: _container dependency initialization_."""
        state = PythonContainerAliasState()
        keys = PythonContainerKeys(state)
        values = PythonContainerValues(state, keys)
        aliases = PythonContainerAliases(state, keys, values, node_index)
        self.aliases: PythonContainerAliasesContract = aliases
        self.values: PythonContainerValuesContract = values
        self.keys: PythonContainerKeysContract = keys

    def container_aliases(self) -> PythonContainerAliasesContract:
        """Responsibilities: _container alias access_."""
        return self.aliases

    def container_values(self) -> PythonContainerValuesContract:
        """Responsibilities: _container value access_."""
        return self.values

    def container_keys(self) -> PythonContainerKeysContract:
        """Responsibilities: _container key access_."""
        return self.keys

    def import_options(
        self,
        core: PythonAstCoreStateContract,
        reference_aliases: PythonReferenceAliasesContract,
        structure_issues: PythonStructureIssuesContract,
    ) -> PythonAstImportStateOptionsContract:
        """Responsibilities: _import state options_."""
        return PythonAstImportStateOptions(
            {
                "tree": core.source_dependencies().syntax_tree(),
                "node_index": core.source_dependencies().node_index(),
                "container_aliases": core.container_aliases(),
                "reference_aliases": reference_aliases,
                "structure_issues": structure_issues,
            }
        )
