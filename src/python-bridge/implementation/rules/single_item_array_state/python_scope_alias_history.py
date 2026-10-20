import ast
from bisect import bisect_right
from typing import Any

from implementation.ast.protocols import PythonAstNodeIndexContract
from implementation.references.protocols import PythonAssignmentAliasContract
from implementation.types import JsonObject
from implementation.rules.types import (
    PythonScopeAliasHistories,
    PythonScopeAliasHistoryData,
    PythonScopeTypes,
)


class PythonScopeAliasHistory:
    """Responsibilities: _scope assignment history_, _positioned alias resolution_."""

    def _scope_chain(self, node: ast.AST) -> list[ast.AST]:
        """Responsibilities: _enclosing scope collection_."""
        scopes: list[ast.AST] = []
        current: Any = node
        while True:
            parents: Any = self.node_index.parents(current)
            if not parents:
                return scopes
            parent: Any = parents[0]
            if type(parent) in self.scope_types:
                scopes.append(parent)
            current = parent

    def _ordered_assignments(self, scope: ast.AST) -> list[ast.AST]:
        """Responsibilities: _scoped assignment collection_."""
        if scope in self._assignment_cache:
            return self._assignment_cache[scope]
        assignments = []
        for item in self.node_index.nodes(scope):
            if type(item) not in (ast.Assign, ast.AnnAssign):
                continue
            item_scopes = self._scope_chain(item)
            if not item_scopes:
                continue
            if item_scopes[0] is scope:
                assignments.append(item)
        ordered = sorted(assignments, key=lambda item: (item.lineno, item.col_offset))
        self._assignment_cache[scope] = ordered
        return ordered

    def _lookup(
        self, history: PythonScopeAliasHistoryData, name: str, line: int
    ) -> JsonObject:
        """Responsibilities: _alias timeline lookup_."""
        timeline = history.get(name)
        if timeline is None:
            return {"found": False, "target": name}
        lines = [int(entry["line"]) for entry in timeline]
        index = bisect_right(lines, line) - 1
        if index < 0:
            return {"found": False, "target": name}
        return {"found": True, "target": timeline[index]["target"]}

    def _scope_history(self, scope: ast.AST) -> PythonScopeAliasHistoryData:
        """Responsibilities: _scoped alias history construction_."""
        cached = self._history_cache.get(scope)
        if cached is not None:
            return cached
        history: PythonScopeAliasHistoryData = {}
        for item in self._ordered_assignments(scope):
            for name, target in self.alias_source.assignment_aliases(item).items():
                history.setdefault(name, []).append(
                    {"line": item.lineno, "target": target}
                )
        self._history_cache[scope] = history
        return history

    def __init__(
        self,
        node_index: PythonAstNodeIndexContract,
        scope_types: PythonScopeTypes,
        alias_source: PythonAssignmentAliasContract,
    ) -> None:
        """Responsibilities: _alias index initialization_."""
        self.node_index: PythonAstNodeIndexContract = node_index
        self.scope_types: PythonScopeTypes = scope_types
        self.alias_source: PythonAssignmentAliasContract = alias_source
        self._assignment_cache: dict[ast.AST, list[ast.AST]] = {}
        self._history_cache: PythonScopeAliasHistories = {}

    def resolve_scope(self, scope: ast.AST, name: str, line: int) -> JsonObject:
        """Responsibilities: _scope alias chain_."""
        resolved = name
        seen: set[str] = set()
        found = False
        while resolved not in seen:
            resolution = self._lookup(self._scope_history(scope), resolved, line)
            if not bool(resolution["found"]):
                return {"found": found, "target": resolved}
            found = bool(resolution["found"])
            seen.add(resolved)
            resolved = str(resolution["target"])
        return {"found": found, "target": resolved}

    def resolve(self, node: ast.AST, name: str, line: int) -> JsonObject:
        """Responsibilities: _scoped alias lookup_."""
        for scope in self._scope_chain(node):
            resolution = self.resolve_scope(scope, name, line)
            if bool(resolution["found"]):
                return resolution
        return {"found": False, "target": name}
