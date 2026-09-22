from __future__ import annotations

from typing import Protocol
import ast


class PythonAstNodeIndexProtocol(Protocol):
    """Responsibilities: _define AST node parent_."""

    def nodes(self, root: ast.AST) -> list[ast.AST]: ...

    def parents(self, node: ast.AST) -> list[ast.AST]: ...
