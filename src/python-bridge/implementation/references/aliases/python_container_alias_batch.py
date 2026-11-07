from __future__ import annotations

import ast

from implementation.references.protocols import PythonContainerAliasesContract


class PythonContainerAliasBatch:
    """Responsibilities: _alias scope setup_, _alias event traversal_."""

    def __init__(self, aliases: list[PythonContainerAliasesContract]) -> None:
        """Responsibilities: _container alias ownership_."""
        self._aliases: list[PythonContainerAliasesContract] = aliases

    def configure(self, tree: ast.AST) -> None:
        """Responsibilities: _container alias scope setup_."""
        for alias_index in self._aliases:
            alias_index.clear()
            alias_index.state().configure_scope_tree(tree)

    def observe_all(self, nodes: list[ast.AST], tree: ast.AST) -> None:
        """Responsibilities: _container alias event traversal_."""
        self.configure(tree)
        if not self._aliases:
            return
        node_index = self._aliases[0].state().node_index()
        alias_nodes = node_index.alias_event_nodes(tree, nodes)
        for node in alias_nodes:
            for alias_index in self._aliases:
                alias_index.observe(node)
        if nodes:
            final_node = nodes[-1]
            if not alias_nodes or alias_nodes[-1] is not final_node:
                for alias_index in self._aliases:
                    alias_index.state().select_scope_node(final_node)
