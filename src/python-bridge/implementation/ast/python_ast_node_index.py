from __future__ import annotations

import ast
from typing import Any


class PythonAstNodeIndex:
    """Responsibilities: _AST subtree traversal caching_, _parent scope indexing_."""

    def _append_parent(self, parent: ast.AST, child: ast.AST) -> None:
        """Responsibilities: _AST parent index update_."""
        parent_list = self._parents.get(child)
        if parent_list is None:
            self._parents[child] = [parent]
            return
        parent_list.append(parent)

    def _subtree_nodes(self, root: ast.AST) -> list[ast.AST]:
        """Responsibilities: _cached subtree traversal_."""
        nodes = [root]
        for parent in nodes:
            nodes.extend(self._children.get(parent, []))
        return nodes

    def _append_children(
        self,
        parent: ast.AST,
        nodes: list[ast.AST],
        scopes: dict[ast.AST, str],
    ) -> None:
        """Responsibilities: _child index_."""
        scope = scopes[parent]
        if type(parent) in (
            ast.FunctionDef,
            ast.AsyncFunctionDef,
            ast.Lambda,
            ast.ClassDef,
        ):
            scope = f"{scope}:{id(parent)}"
        children = list(ast.iter_child_nodes(parent))
        self._children[parent] = children
        for child in children:
            nodes.append(child)
            scopes[child] = scope
            self._append_parent(parent, child)

    def _cache_nodes(self, root: ast.AST) -> list[ast.AST]:
        """Responsibilities: _traversal caching nodes AST_."""
        nodes: Any = [root]
        scopes: dict[ast.AST, str] = {root: "module"}
        for parent in nodes:
            self._append_children(parent, nodes, scopes)
        self._cache[root] = nodes
        self._scopes[root] = scopes
        for node in nodes:
            self._roots[node] = root
        return nodes

    def __init__(self) -> None:
        """Responsibilities: _initialization per-tree node caching_."""
        self._cache: dict[ast.AST, list[ast.AST]] = {}
        self._parents: dict[ast.AST, list[ast.AST]] = {}
        self._scopes: dict[ast.AST, dict[ast.AST, str]] = {}
        self._children: dict[ast.AST, list[ast.AST]] = {}
        self._roots: dict[ast.AST, ast.AST] = {}

    def nodes(self, root: ast.AST) -> list[ast.AST]:
        """Responsibilities: _output caching nodes construction_."""
        if root in self._cache:
            return self._cache[root]
        owner = self._roots.get(root)
        if owner is not None:
            nodes = self._subtree_nodes(root)
            self._cache[root] = nodes
            return nodes
        return self._cache_nodes(root)

    def children(self, node: ast.AST) -> list[ast.AST]:
        """Responsibilities: _cached direct AST children_."""
        children = self._children.get(node)
        if children is None:
            self.nodes(node)
            children = self._children.get(node, [])
        return children

    def parents(self, node: ast.AST) -> list[ast.AST]:
        """Responsibilities: _output parent path caching_."""
        return self._parents.get(node, [])

    def scopes(self, root: ast.AST) -> dict[ast.AST, str]:
        """Responsibilities: _output lexical scope caching_."""
        self.nodes(root)
        if root not in self._scopes:
            owner = self._roots[root]
            owner_scopes = self._scopes[owner]
            self._scopes[root] = {
                node: owner_scopes[node] for node in self._cache[root]
            }
        return self._scopes[root]
