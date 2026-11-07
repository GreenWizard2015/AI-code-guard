from __future__ import annotations

from implementation.ast.protocols import PythonAstNodeIndexContract
from implementation.references.aliases.python_container_alias_state import (
    PythonContainerAliasState,
)
from implementation.references.aliases.python_container_aliases import (
    PythonContainerAliases,
)
from implementation.references.aliases.python_container_items import (
    PythonContainerItems,
)
from implementation.references.aliases.python_container_keys import PythonContainerKeys
from implementation.references.aliases.python_container_values import (
    PythonContainerValues,
)
from implementation.references.protocols import (
    PythonContainerAliasesContract,
    PythonContainerKeysContract,
    PythonContainerValuesContract,
)


class PythonContainerAssembly:
    """Responsibilities: _container analyzer composition_, _container collection access_."""

    _aliases: PythonContainerAliasesContract
    _values: PythonContainerValuesContract
    _keys: PythonContainerKeysContract

    def __init__(self, node_index: PythonAstNodeIndexContract) -> None:
        """Responsibilities: _container dependency initialization_."""
        state = PythonContainerAliasState(node_index)
        keys = PythonContainerKeys(state)
        items = PythonContainerItems(state, keys)
        values = PythonContainerValues(state, keys, items)
        aliases = PythonContainerAliases(state, keys, values, items)
        self._aliases: PythonContainerAliasesContract = aliases
        self._values: PythonContainerValuesContract = values
        self._keys: PythonContainerKeysContract = keys

    def container_aliases(self) -> PythonContainerAliasesContract:
        """Responsibilities: _container alias access_."""
        return self._aliases

    def container_values(self) -> PythonContainerValuesContract:
        """Responsibilities: _container value access_."""
        return self._values

    def container_keys(self) -> PythonContainerKeysContract:
        """Responsibilities: _container key access_."""
        return self._keys
