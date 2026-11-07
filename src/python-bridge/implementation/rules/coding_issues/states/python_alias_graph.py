from __future__ import annotations

import ast

from implementation.rules.coding_issues.states.alias_walk_state import AliasWalkState
from implementation.rules.protocols import AliasWalkStateContract
from implementation.rules.types import AliasWalkStateData


class PythonAliasGraph:
    """Responsibilities: _Python alias graph_, _alias result cache_."""

    _aliases: dict[str, str]
    _bindings: dict[str, ast.expr]
    _resolved: dict[str, ast.expr]

    def _walk(self, state: AliasWalkStateContract) -> AliasWalkStateContract:
        """Responsibilities: _iterative alias chain traversal_."""
        while True:
            state = state.known_result()
            snapshot = state.snapshot()
            if snapshot.result_present:
                return state
            cycle_start = snapshot.positions.get(snapshot.current)
            if cycle_start is not None:
                return state.cycle_result(cycle_start)
            source = snapshot.aliases.get(snapshot.current)
            if source is None:
                return state.with_result(ast.Constant(value=None))
            state = state.visit(source)

    def _cache_result(self, requested_alias_name: str) -> ast.expr:
        """Responsibilities: _alias result caching_."""
        initial_state = AliasWalkState(
            AliasWalkStateData(
                requested_alias_name,
                self._aliases,
                self._bindings,
                self._resolved,
                [],
                {},
                ast.Constant(value=None),
                result_present=False,
            ),
        )
        result_state = self._walk(initial_state)
        snapshot = result_state.snapshot()
        expression = snapshot.result
        for path_alias in reversed(snapshot.path):
            if path_alias not in self._resolved:
                self._resolved.update({path_alias: expression})
            expression = self._resolved[path_alias]
        return self._resolved.get(requested_alias_name, expression)

    def __init__(self, aliases: dict[str, str], bindings: dict[str, ast.expr]) -> None:
        """Responsibilities: _alias graph storage_."""
        self._aliases = aliases
        self._bindings = bindings
        self._resolved = {}

    def resolve(self, alias_name: str) -> ast.expr:
        """Responsibilities: _single alias lookup_."""
        if alias_name in self._bindings:
            return self._bindings[alias_name]
        if alias_name not in self._resolved:
            return self._cache_result(alias_name)
        return self._resolved[alias_name]

    def resolve_all(self) -> dict[str, ast.expr]:
        """Responsibilities: _complete alias map resolution_."""
        return {alias_name: self.resolve(alias_name) for alias_name in self._aliases}
