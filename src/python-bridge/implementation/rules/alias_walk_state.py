from __future__ import annotations

import ast

from implementation.rules.protocols import AliasWalkStateContract
from implementation.rules.types import AliasWalkStateDataContract


class AliasWalkState:
    """Responsibilities: _alias traversal state_, _cycle result construction_."""

    def __init__(self, options: AliasWalkStateDataContract) -> None:
        """Responsibilities: _alias state fields_."""
        self.current: str = options.current
        self.aliases: dict[str, str] = options.aliases
        self.bindings: dict[str, ast.expr] = options.bindings
        self.resolution_map: dict[str, ast.expr] = options.resolution_map
        self.path: list[str] = options.path
        self.positions: dict[str, int] = options.positions
        self.result: ast.expr = options.result
        self.result_present: bool = options.result_present

    def snapshot(self) -> AliasWalkStateDataContract:
        """Responsibilities: _alias traversal snapshot_."""
        return AliasWalkStateDataContract(
            self.current,
            self.aliases,
            self.bindings,
            self.resolution_map,
            self.path,
            self.positions,
            self.result,
            self.result_present,
        )

    def known_result(self) -> AliasWalkStateContract:
        """Responsibilities: _known alias lookup_."""
        if self.current in self.bindings:
            return self.with_result(self.bindings[self.current])
        if self.current in self.resolution_map:
            return self.with_result(self.resolution_map[self.current])
        return self

    def with_result(self, result: ast.expr) -> AliasWalkStateContract:
        """Responsibilities: _alias result transition_."""
        return AliasWalkState(
            AliasWalkStateDataContract(
                self.current,
                self.aliases,
                self.bindings,
                self.resolution_map,
                self.path,
                self.positions,
                result,
                True,
            )
        )

    def visit(self, source: str) -> AliasWalkStateContract:
        """Responsibilities: _alias source transition_."""
        self.positions[self.current] = len(self.path)
        self.path.append(self.current)
        return AliasWalkState(
            AliasWalkStateDataContract(
                source,
                self.aliases,
                self.bindings,
                self.resolution_map,
                self.path,
                self.positions,
                self.result,
                self.result_present,
            )
        )

    def cycle_result(self, cycle_start: int) -> AliasWalkStateContract:
        """Responsibilities: _alias cycle resolution_."""
        result: ast.expr = ast.Constant(value=None)
        resolution_map = dict(self.resolution_map)
        for cycle_name in self.path[cycle_start:]:
            resolution_map[cycle_name] = result
        return AliasWalkState(
            AliasWalkStateDataContract(
                self.current,
                self.aliases,
                self.bindings,
                resolution_map,
                self.path[:cycle_start],
                self.positions,
                result,
                True,
            )
        )
