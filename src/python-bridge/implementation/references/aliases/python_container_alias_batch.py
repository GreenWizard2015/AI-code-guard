from __future__ import annotations

import ast

from implementation.references.aliases.protocols import PythonContainerAliasesContract


class PythonContainerAliasBatch:
    """Responsibilities: _alias scope setup_, _alias event traversal_."""

    def _is_alias_event(self, node: ast.AST) -> bool:
        """Responsibilities: _alias event classification_."""
        if type(node) is ast.Import or type(node) is ast.Assign:
            return True
        if type(node) is ast.AnnAssign:
            return node.value is not None
        return False

    def __init__(self, aliases: list[PythonContainerAliasesContract]) -> None:
        """Responsibilities: _container alias ownership_."""
        self._aliases: list[PythonContainerAliasesContract] = aliases

    def configure(self, tree: ast.AST) -> None:
        """Responsibilities: _container alias scope setup_."""
        for alias_index in self._aliases:
            alias_index.clear()
            alias_index._configure_scope_tree(tree)

    def observe_all(self, nodes: list[ast.AST], tree: ast.AST) -> None:
        """Responsibilities: _container alias event traversal_."""
        self.configure(tree)
        for node in nodes:
            if self._is_alias_event(node):
                for alias_index in self._aliases:
                    alias_index.observe(node)
        if nodes:
            final_node = nodes[-1]
            if not self._is_alias_event(final_node):
                for alias_index in self._aliases:
                    alias_index.observe(final_node)
