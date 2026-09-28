from __future__ import annotations


from implementation.ast.protocols import PythonAstNodeIndexProtocol
import ast


class PythonFunctionOwner:
    """Responsibilities: _resolution Python function ownership_."""

    def __init__(
        self, tree: ast.Module, node_index: PythonAstNodeIndexProtocol
    ) -> None:
        """Responsibilities: _initialization Python function ownership_."""
        self.tree: ast.Module = tree
        self.node_index: PythonAstNodeIndexProtocol = node_index

    def resolve(self, node: ast.AST) -> ast.AST:
        """Responsibilities: _resolution enclosing function owner_."""
        current: ast.AST = node
        parents = self.node_index.parents(current)
        while parents:
            current = parents[0]
            if type(current) in (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef):
                return current
            parents = self.node_index.parents(current)
        return self.tree

    def nested(self, node: ast.AST) -> bool:
        """Responsibilities: _classification nested Python function_."""
        current: ast.AST = node
        parents = self.node_index.parents(current)
        while parents:
            current = parents[0]
            if type(current) in (ast.FunctionDef, ast.AsyncFunctionDef):
                return True
            if type(current) is ast.ClassDef:
                return False
            parents = self.node_index.parents(current)
        return False
