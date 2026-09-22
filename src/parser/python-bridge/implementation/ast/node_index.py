from __future__ import annotations
from typing import Any


import ast


class PythonAstNodeIndex:
    """Responsibilities: _caching AST traversal provision_."""

    def __init__(self) -> None:
        """Responsibilities: _initialization per-tree node caching_."""
        self._cache: dict[ast.AST, list[ast.AST]] = {}
        self._parents: dict[ast.AST, list[ast.AST]] = {}

    def cache_nodes(self, root: ast.AST) -> list[ast.AST]:
        """Responsibilities: _traversal caching nodes AST_."""
        nodes: Any = list(ast.walk(root))
        self._cache[root] = nodes
        for parent in nodes:
            for child in ast.iter_child_nodes(parent):
                self._parents.setdefault(child, []).append(parent)
        return nodes

    def nodes(self, root: ast.AST) -> list[ast.AST]:
        """Responsibilities: _output caching nodes construction_."""
        if root in self._cache:
            return self._cache[root]
        return self.cache_nodes(root)

    def clear(self) -> int:
        """Responsibilities: _AST node cache cleanup_."""
        cleared_nodes: Any = len(self._cache)
        self._cache.clear()
        self._parents.clear()
        return cleared_nodes

    def parents(self, node: ast.AST) -> list[ast.AST]:
        """Responsibilities: _output parent path caching_."""
        return self._parents.get(node, [])
