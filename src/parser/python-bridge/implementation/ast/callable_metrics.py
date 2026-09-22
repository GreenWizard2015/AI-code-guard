from __future__ import annotations
from typing import Any


import ast


class CallableMetrics:
    """Responsibilities: _calculation Python statement block_."""

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
