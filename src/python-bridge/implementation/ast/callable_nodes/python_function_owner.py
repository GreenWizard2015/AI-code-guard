from __future__ import annotations

import ast

from implementation.ast.protocols import PythonAstNodeIndexContract


class PythonFunctionOwner:
    """Responsibilities: _function owner resolution_, _nested function detection_."""

    def __init__(
        self,
        tree: ast.Module,
        node_index: PythonAstNodeIndexContract,
    ) -> None:
        """Responsibilities: _initialization Python function ownership_."""
        self._tree: ast.Module = tree
        self._node_index: PythonAstNodeIndexContract = node_index

    def resolve(self, node: ast.AST) -> ast.AST:
        """Responsibilities: _resolution enclosing function owner_."""
        current: ast.AST = node
        parents = self._node_index.parents(current)
        while parents:
            current = parents[0]
            if type(current) in (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef):
                return current
            parents = self._node_index.parents(current)
        return self._tree

    def nested(self, node: ast.AST) -> bool:
        """Responsibilities: _classification nested Python function_."""
        current: ast.AST = node
        parents = self._node_index.parents(current)
        while parents:
            current = parents[0]
            if type(current) in (ast.FunctionDef, ast.AsyncFunctionDef):
                return True
            if type(current) is ast.ClassDef:
                return False
            parents = self._node_index.parents(current)
        return False
