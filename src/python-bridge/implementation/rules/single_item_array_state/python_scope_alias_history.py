import ast
from bisect import bisect_right
from typing import cast

from implementation.ast.protocols import PythonAstNodeIndexContract
from implementation.references.protocols import PythonAssignmentAliasContract
from implementation.rules.types import (
    PythonScopeAliasHistories,
    PythonScopeAliasHistoryData,
    PythonScopeTypes,
)
from implementation.types import JsonObject, PythonASTLocatedNode, PythonAstNodeListIndex


class PythonScopeAliasHistory:
    """Responsibilities: _scope assignment history_, _positioned alias resolution_."""

    def _scope_chain(self, node: ast.AST) -> list[ast.AST]:
        """Responsibilities: _enclosing scope collection_."""
        scopes: list[ast.AST] = []
        current: ast.AST = node
        while True:
            parents = self._node_index.parents(current)
            if not parents:
                return scopes
            parent = parents[0]
            if type(parent) in self._scope_types:
                scopes.append(parent)
            current = parent

    def _lookup(
        self,
        history: PythonScopeAliasHistoryData,
        alias_name: str,
        use_line: int,
    ) -> JsonObject:
        """Responsibilities: _alias timeline lookup_."""
        timeline = history.get(alias_name)
        if timeline is None:
            return {"found": False, "target": alias_name}
        lines: list[int] = []
        valid_entries: list[JsonObject] = []
        for entry in timeline:
            line = entry["line"]
            if type(line) is int:
                lines.append(line)
                valid_entries.append(entry)
        index = bisect_right(lines, use_line) - 1
        if index < 0:
            return {"found": False, "target": alias_name}
        return {"found": True, "target": valid_entries[index]["target"]}

    def _owner_assignments(self, owner_scope: ast.AST) -> list[ast.AST]:
        """Responsibilities: _scope-owned assignment selection_."""
        assignments: list[ast.AST] = []
        for item in self._node_index.nodes(owner_scope):
            if type(item) not in (ast.Assign, ast.AnnAssign):
                continue
            item_scopes = self._scope_chain(item)
            if item_scopes and item_scopes[0] is owner_scope:
                assignments.append(item)
        return sorted(
            assignments,
            key=lambda item: (
                cast(PythonASTLocatedNode, item).lineno,
                cast(PythonASTLocatedNode, item).col_offset,
            ),
        )

    def _scope_history(self, scope: ast.AST) -> PythonScopeAliasHistoryData:
        """Responsibilities: _scoped alias history construction_."""
        cached = self._history_cache.get(scope)
        if cached is not None:
            return cached
        history: PythonScopeAliasHistoryData = {}
        if scope not in self._assignment_cache:
            self._assignment_cache.update({scope: self._owner_assignments(scope)})
        for assignment in self._assignment_cache[scope]:
            aliases = self._alias_source.assignment_aliases(assignment)
            for name, target in aliases.items():
                history.setdefault(name, []).append(
                    {"line": cast(PythonASTLocatedNode, assignment).lineno, "target": target},
                )
        self._history_cache.update({scope: history})
        return history

    def __init__(
        self,
        node_index: PythonAstNodeIndexContract,
        scope_types: PythonScopeTypes,
        alias_source: PythonAssignmentAliasContract,
    ) -> None:
        """Responsibilities: _alias index initialization_."""
        self._node_index: PythonAstNodeIndexContract = node_index
        self._scope_types: PythonScopeTypes = scope_types
        self._alias_source: PythonAssignmentAliasContract = alias_source
        self._assignment_cache: PythonAstNodeListIndex = {}
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
