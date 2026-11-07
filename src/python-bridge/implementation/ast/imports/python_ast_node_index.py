from __future__ import annotations

import ast
from collections.abc import Sequence

from implementation.ast.constants import AST_SCOPE_NODE_TYPES
from implementation.types import (
    PythonAstClassDefinitions,
    PythonAstNodeListIndex,
    PythonAstScopeIndex,
)


class PythonAstNodeIndex:
    """Responsibilities: _AST subtree traversal caching_, _parent scope indexing_."""

    def _subtree_nodes(self, subtree_root: ast.AST) -> list[ast.AST]:
        """Responsibilities: _cached subtree traversal_."""
        nodes = [subtree_root]
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
        if type(parent) in AST_SCOPE_NODE_TYPES:
            scope = f"{scope}:{id(parent)}"
        children = list(ast.iter_child_nodes(parent))
        nodes.extend(children)
        self._children[parent] = children
        for child in children:
            scopes[child] = scope
            self._parents.setdefault(child, []).append(parent)

    def _publish_root_cache(
        self,
        root_tree: ast.AST,
        root_nodes: list[ast.AST],
        scope_index: dict[ast.AST, str],
        class_nodes: list[ast.ClassDef],
    ) -> None:
        """Responsibilities: _root AST index publication_."""
        self._cache[root_tree] = root_nodes
        self._scopes[root_tree] = scope_index
        self._class_definitions[root_tree] = class_nodes
        self.alias_event_nodes(root_tree, root_nodes)

    def _cache_nodes(self, cache_root: ast.AST) -> list[ast.AST]:
        """Responsibilities: _traversal caching nodes AST_."""
        nodes: list[ast.AST] = [cache_root]
        scopes: dict[ast.AST, str] = {cache_root: "module"}
        class_definitions: list[ast.ClassDef] = []
        for parent in nodes:
            self._roots[parent] = cache_root
            if type(parent) is ast.ClassDef:
                class_definitions.append(parent)
            self._append_children(parent, nodes, scopes)
        self._publish_root_cache(cache_root, nodes, scopes, class_definitions)
        return nodes

    def __init__(self) -> None:
        """Responsibilities: _initialization per-tree node caching_."""
        self._cache: PythonAstNodeListIndex = {}
        self._parents: PythonAstNodeListIndex = {}
        self._scopes: PythonAstScopeIndex = {}
        self._children: PythonAstNodeListIndex = {}
        self._roots: dict[ast.AST, ast.AST] = {}
        self._class_definitions: PythonAstClassDefinitions = {}
        self._alias_events: PythonAstNodeListIndex = {}

    def nodes(self, requested_root: ast.AST) -> list[ast.AST]:
        """Responsibilities: _output caching nodes construction_."""
        cached_nodes = self._cache.get(requested_root)
        if cached_nodes is not None:
            return cached_nodes
        owner = self._roots.get(requested_root)
        if owner is not None:
            nodes = self._subtree_nodes(requested_root)
            self._cache.update({requested_root: nodes})
            return nodes
        return self._cache_nodes(requested_root)

    def class_definitions(self, requested_root: ast.AST) -> list[ast.ClassDef]:
        """Responsibilities: _ordered class definition lookup_."""
        self.nodes(requested_root)
        if requested_root not in self._class_definitions:
            definitions = [node for node in self._cache[requested_root] if type(node) is ast.ClassDef]
            self._class_definitions[requested_root] = definitions
        return self._class_definitions[requested_root]

    def alias_event_nodes(
        self,
        syntax_tree: ast.AST,
        ordered_nodes: Sequence[ast.AST],
    ) -> list[ast.AST]:
        """Responsibilities: _cached alias event selection_."""
        indexed_nodes = self._cache.get(syntax_tree)
        if ordered_nodes is indexed_nodes:
            cached_events = self._alias_events.get(syntax_tree)
            if cached_events is not None:
                return cached_events
        events: list[ast.AST] = []
        for node in ordered_nodes:
            match node:
                case ast.Import() | ast.Assign() if type(node) in (ast.Import, ast.Assign):
                    events.append(node)
                case ast.AnnAssign() if type(node) is ast.AnnAssign and node.value is not None:
                    events.append(node)
        if ordered_nodes is indexed_nodes:
            self._alias_events[syntax_tree] = events
        return events

    def children(self, node: ast.AST) -> list[ast.AST]:
        """Responsibilities: _cached direct AST children_."""
        try:
            return self._children[node]
        except KeyError:
            self.nodes(node)
            return self._children.get(node, [])

    def parents(self, node: ast.AST) -> list[ast.AST]:
        """Responsibilities: _output parent path caching_."""
        return self._parents.get(node, [])

    def scopes(self, scope_root: ast.AST) -> dict[ast.AST, str]:
        """Responsibilities: _output lexical scope caching_."""
        self.nodes(scope_root)
        if scope_root not in self._scopes:
            owner = self._roots[scope_root]
            owner_scopes = self._scopes[owner]
            self._scopes.update({scope_root: {node: owner_scopes[node] for node in self._cache[scope_root]}})
        return self._scopes[scope_root]
