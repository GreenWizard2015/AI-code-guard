from __future__ import annotations

import ast

from implementation.ast.constants import AST_CONTROL_FLOW_NODE_TYPES
from implementation.ast.protocols import (
    PythonAstNodeIndexContract,
    PythonCallableMetricsContract,
)


class CallableMetrics(PythonCallableMetricsContract):
    """Responsibilities: _statement SLOC calculation_, _control flow depth analysis_."""

    def __init__(self, node_index: PythonAstNodeIndexContract) -> None:
        """Responsibilities: _callable metric dependencies_."""
        self._node_index: PythonAstNodeIndexContract = node_index

    def _match_sloc(self, item: ast.Match) -> int:
        """Responsibilities: _calculation SLOC match statement_."""
        sloc = 0
        for case in item.cases:
            for child in case.body:
                sloc += self.statement_sloc(child)
        return sloc

    def _blocks_sloc(self, *blocks: list[ast.stmt]) -> int:
        """Responsibilities: _aggregation statement SLOC multiple_."""
        sloc = 0
        for block in blocks:
            for child in block:
                sloc += self.statement_sloc(child)
        return sloc

    def _try_sloc(self, item: ast.Try) -> int:
        """Responsibilities: _calculation SLOC try except_."""
        blocks: list[list[ast.stmt]] = [item.body, item.finalbody, item.orelse]
        blocks.extend(handler.body for handler in item.handlers)
        return 1 + self._blocks_sloc(*blocks)

    def _control_depth(self, node: ast.AST, depth: int) -> int:
        """Responsibilities: _control-flow nesting depth_."""
        pending_nodes: list[ast.AST] = [node]
        pending_depths: list[int] = [depth]
        maximum = depth
        while pending_nodes:
            current = pending_nodes.pop()
            current_depth = pending_depths.pop()
            if type(current) in (ast.FunctionDef, ast.AsyncFunctionDef, ast.Lambda):
                maximum = max(maximum, current_depth)
                continue
            next_depth = current_depth + int(type(current) in AST_CONTROL_FLOW_NODE_TYPES)
            maximum = max(maximum, next_depth)
            for child in self._node_index.children(current):
                pending_nodes.append(child)
                pending_depths.append(next_depth)
        return maximum

    def statement_sloc(self, item: ast.stmt) -> int:
        """Responsibilities: _calculation SLOC Python statement_."""
        match item:
            case (
                ast.If(body=body, orelse=orelse)
                | ast.For(body=body, orelse=orelse)
                | ast.AsyncFor(body=body, orelse=orelse)
                | ast.While(body=body, orelse=orelse)
            ) if type(item) in (ast.If, ast.For, ast.AsyncFor, ast.While):
                return 1 + self._blocks_sloc(body, orelse)
            case ast.With(body=body) | ast.AsyncWith(body=body) if type(item) in (
                ast.With,
                ast.AsyncWith,
            ):
                return 1 + self._blocks_sloc(body)
            case ast.Try() if type(item) is ast.Try:
                return self._try_sloc(item)
            case ast.Match() if type(item) is ast.Match:
                return 1 + self._match_sloc(item)
            case _:
                return 1

    def statements_sloc(self, items: list[ast.stmt]) -> int:
        """Responsibilities: _Python statement SLOC aggregation_."""
        sloc = 0
        for item in items:
            sloc += self.statement_sloc(item)
        return sloc

    def control_flow_depth(self, items: list[ast.stmt]) -> int:
        """Responsibilities: _callable control-flow depth_."""
        return max((self._control_depth(item, 0) for item in items), default=0)
