from __future__ import annotations

import ast

from implementation.ast.protocols import PythonAstNodeIndexContract
from implementation.references.alias_types import (
    ContainerAliasScopes,
    ContainerItemMap,
    StaticContainerAliasScopes,
)
from implementation.references.aliases.python_container_alias import (
    PythonContainerAlias,
)
from implementation.references.protocols import (
    PythonContainerAliasContract,
)


class PythonContainerAliasState:
    """Responsibilities: _lexical scope tracking_, _container alias lookup_."""

    def __init__(self, node_index: PythonAstNodeIndexContract) -> None:
        """Responsibilities: _container alias state initialization_."""
        self._node_index: PythonAstNodeIndexContract = node_index
        self._aliases: ContainerAliasScopes = {"module": {}}
        self._static_aliases: StaticContainerAliasScopes = {"module": {}}
        self._node_scopes: dict[ast.AST, str] = {}
        self._current_scope: str = "module"

    def node_index(self) -> PythonAstNodeIndexContract:
        """Responsibilities: _AST index access_."""
        return self._node_index

    def select_scope_node(self, node: ast.AST) -> None:
        """Responsibilities: _lexical alias scope selection_."""
        self._current_scope = self._node_scopes.get(node, "module")

    def configure_scope_tree(self, tree: ast.AST) -> None:
        """Responsibilities: _lexical scope index configuration_."""
        scopes = self._node_index.scopes(tree)
        if not scopes:
            raise ValueError("Python AST scope index cannot be empty.")
        self._node_scopes = scopes
        self._current_scope = "module"

    def record_alias(
        self,
        container_alias_name: str,
        static_value: str,
        values: ContainerItemMap,
    ) -> None:
        """Responsibilities: _scoped container alias recording_."""
        current_scope = self._current_scope
        static_aliases = self._static_aliases.setdefault(current_scope, {})
        static_aliases[container_alias_name] = static_value
        aliases = self._aliases.setdefault(current_scope, {})
        aliases[container_alias_name] = dict(values)

    def clear(self) -> None:
        """Responsibilities: _container alias state reset_."""
        self._aliases.clear()
        self._aliases.update({"module": {}})
        self._static_aliases.clear()
        self._static_aliases.update({"module": {}})
        self._current_scope = "module"

    def alias(self, lookup_name: str) -> PythonContainerAliasContract:
        """Responsibilities: _named container alias resolution_."""
        current_scope = self._current_scope
        current = self._static_aliases.get(current_scope, {})
        static_value = current.get(
            lookup_name,
            self._static_aliases.get("module", {}).get(lookup_name, ""),
        )
        aliases = self._aliases.get(current_scope, {})
        if current_scope != "module" and lookup_name in aliases:
            values = aliases[lookup_name]
        else:
            values = self._aliases.get("module", {}).get(lookup_name, {})
        return PythonContainerAlias(static_value, values)
