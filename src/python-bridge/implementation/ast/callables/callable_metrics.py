from __future__ import annotations

import ast
from typing import Any


class CallableMetrics:
    """Responsibilities: _statement SLOC calculation_, _control flow depth analysis_."""

    def _match_sloc(self, item: ast.Match) -> int:
        """Responsibilities: _calculation SLOC match statement_."""
        sloc: Any = 0
        for case in item.cases:
            for child in case.body:
                sloc += self.statement_sloc(child)
        return sloc

    def _blocks_sloc(self, *blocks: list[ast.stmt]) -> int:
        """Responsibilities: _aggregation statement SLOC multiple_."""
        sloc: Any = 0
        for block in blocks:
            for child in block:
                sloc += self.statement_sloc(child)
        return sloc

    def _try_sloc(self, item: ast.Try) -> int:
        """Responsibilities: _calculation SLOC try except_."""
        blocks: Any = [item.body, item.finalbody, item.orelse]
        blocks.extend(handler.body for handler in item.handlers)
        return 1 + self._blocks_sloc(*blocks)

    def _control_depth(self, node: ast.AST, depth: int) -> int:
        """Responsibilities: _control-flow nesting depth_."""
        if type(node) in (ast.FunctionDef, ast.AsyncFunctionDef, ast.Lambda):
            return depth
        controls = (
            ast.If,
            ast.For,
            ast.AsyncFor,
            ast.While,
            ast.Try,
            ast.With,
            ast.AsyncWith,
            ast.Match,
        )
        next_depth = depth
        if type(node) in controls:
            next_depth += 1
        maximum = next_depth
        for child in ast.iter_child_nodes(node):
            maximum = max(maximum, self._control_depth(child, next_depth))
        return maximum

    def __init__(self) -> None:
        """Responsibilities: _initialization compound statement SLOC_."""
        self.block_types: Any = (ast.If, ast.For, ast.AsyncFor, ast.While)
        self.with_types: Any = (ast.With, ast.AsyncWith)

    def statement_sloc(self, item: ast.stmt) -> int:
        """Responsibilities: _calculation SLOC Python statement_."""
        if type(item) in self.block_types:
            return 1 + self._blocks_sloc(item.body, item.orelse)
        if type(item) in self.with_types:
            return 1 + self._blocks_sloc(item.body)
        if type(item) is ast.Try:
            return self._try_sloc(item)
        if type(item) is ast.Match:
            return 1 + self._match_sloc(item)
        return 1

    def statements_sloc(self, items: list[ast.stmt]) -> int:
        """Responsibilities: _Python statement SLOC aggregation_."""
        sloc: Any = 0
        for item in items:
            sloc += self.statement_sloc(item)
        return sloc

    def control_flow_depth(self, items: list[ast.stmt]) -> int:
        """Responsibilities: _callable control-flow depth_."""
        return max((self._control_depth(item, 0) for item in items), default=0)
