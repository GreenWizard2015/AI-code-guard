from __future__ import annotations

import ast

from implementation.ast.callable_nodes.python_function_owner import PythonFunctionOwner
from implementation.protocols import PythonAstNodeIndexContract


class PythonFunctionSelector:
    """Responsibilities: _function declaration selection_, _nested function detection_."""

    def __init__(
        self, tree: ast.Module, node_index: PythonAstNodeIndexContract
    ) -> None:
        """Responsibilities: _initialization Python function selection_."""
        self.tree: ast.Module = tree
        self.node_index: PythonAstNodeIndexContract = node_index
        self.owner: PythonFunctionOwner = PythonFunctionOwner(tree, node_index)

    def nodes(self) -> list[ast.AST]:
        """Responsibilities: _collection Python function declarations_."""
        result: list[ast.AST] = []
        for node in self.node_index.nodes(self.tree):
            if type(node) not in (ast.FunctionDef, ast.AsyncFunctionDef):
                continue
            owner = self.owner.resolve(node)
            if type(owner) is ast.ClassDef:
                continue
            if type(owner) is not ast.Module:
                if not self.owner.nested(node):
                    continue
            result.append(node)
        return result

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
