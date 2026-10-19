from __future__ import annotations

import ast
from collections.abc import Iterator, Mapping


class PythonCallableScope(Mapping[str, ast.AST]):
    """Responsibilities: _local-first lookup_, _scope iteration_, _scope size_."""

    def __init__(
        self, parent: Mapping[str, ast.AST], local: Mapping[str, ast.AST]
    ) -> None:
        """Responsibilities: _callable scope overlay initialization_."""
        self.parent: Mapping[str, ast.AST] = parent
        self.local: Mapping[str, ast.AST] = local

    def __getitem__(self, name: str) -> ast.AST:
        """Responsibilities: _local-first callable lookup_."""
        if name in self.local:
            return self.local[name]
        return self.parent[name]

    def __iter__(self) -> Iterator[str]:
        """Responsibilities: _visible callable name iteration_."""
        return iter(self.local.keys() | self.parent.keys())

    def __len__(self) -> int:
        """Responsibilities: _visible callable count_."""
        return len(self.local.keys() | self.parent.keys())
