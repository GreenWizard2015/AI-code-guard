from __future__ import annotations

import ast

from implementation.rules.protocols import (
    AliasWalkStateContract,
    AliasWalkStateDataContract,
)
from implementation.rules.types import AliasWalkStateData


class AliasWalkState:
    """Responsibilities: _alias traversal state_, _cycle result construction_."""

    def __init__(self, options: AliasWalkStateDataContract) -> None:
        """Responsibilities: _alias state fields_."""
        self._state: AliasWalkStateDataContract = options

    def snapshot(self) -> AliasWalkStateDataContract:
        """Responsibilities: _alias traversal snapshot_."""
        return AliasWalkStateData(
            self._state.current,
            self._state.aliases,
            self._state.bindings,
            self._state.resolution_map,
            self._state.path,
            self._state.positions,
            self._state.result,
            self._state.result_present,
        )

    def known_result(self) -> AliasWalkStateContract:
        """Responsibilities: _known alias lookup_."""
        if self._state.current in self._state.bindings:
            return self.with_result(self._state.bindings[self._state.current])
        if self._state.current in self._state.resolution_map:
            return self.with_result(self._state.resolution_map[self._state.current])
        return self

    def with_result(self, result: ast.expr) -> AliasWalkStateContract:
        """Responsibilities: _alias result transition_."""
        return AliasWalkState(
            AliasWalkStateData(
                self._state.current,
                self._state.aliases,
                self._state.bindings,
                self._state.resolution_map,
                self._state.path,
                self._state.positions,
                result,
                result_present=True,
            ),
        )

    def visit(self, source: str) -> AliasWalkStateContract:
        """Responsibilities: _alias source transition_."""
        self._state.positions.update({self._state.current: len(self._state.path)})
        self._state.path.append(self._state.current)
        return AliasWalkState(
            AliasWalkStateData(
                source,
                self._state.aliases,
                self._state.bindings,
                self._state.resolution_map,
                self._state.path,
                self._state.positions,
                self._state.result,
                self._state.result_present,
            ),
        )

    def cycle_result(self, cycle_start: int) -> AliasWalkStateContract:
        """Responsibilities: _alias cycle resolution_."""
        result: ast.expr = ast.Constant(value=None)
        resolution_map = dict(self._state.resolution_map)
        for cycle_name in self._state.path[cycle_start:]:
            resolution_map[cycle_name] = result
        return AliasWalkState(
            AliasWalkStateData(
                self._state.current,
                self._state.aliases,
                self._state.bindings,
                resolution_map,
                self._state.path[:cycle_start],
                self._state.positions,
                result,
                result_present=True,
            ),
        )
