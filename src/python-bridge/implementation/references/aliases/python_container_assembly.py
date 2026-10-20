from __future__ import annotations

from implementation.ast.protocols import PythonAstNodeIndexContract
from implementation.references.protocols import (
    PythonContainerAliasesContract,
    PythonContainerKeysContract,
    PythonContainerValuesContract,
)
from implementation.references.aliases.python_container_aliases import (
    PythonContainerAliases,
)
from implementation.references.aliases.python_container_alias_state import (
    PythonContainerAliasState,
)
from implementation.references.aliases.python_container_keys import PythonContainerKeys
from implementation.references.aliases.python_container_values import (
    PythonContainerValues,
)


class PythonContainerAssembly:
    """Responsibilities: _container analyzer composition_, _container collection access_."""

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
