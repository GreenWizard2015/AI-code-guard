from __future__ import annotations

import ast
from collections.abc import Iterator

from implementation.ast.callable_nodes.python_function_owner import PythonFunctionOwner
from implementation.ast.protocols import (
    PythonAstNodeIndexContract,
    PythonFunctionOwnerContract,
)


class PythonFunctionSelector:
    """Responsibilities: _function declaration selection_, _nested function detection_."""

    def _function_nodes(self) -> Iterator[ast.AST]:
        """Responsibilities: _Python function AST iteration_."""
        for node in self._node_index.nodes(self._tree):
            if type(node) in (ast.FunctionDef, ast.AsyncFunctionDef):
                yield node

    def __init__(
        self,
        tree: ast.Module,
        node_index: PythonAstNodeIndexContract,
    ) -> None:
        """Responsibilities: _initialization Python function selection_."""
        self._tree: ast.Module = tree
        self._node_index: PythonAstNodeIndexContract = node_index
        self._owner: PythonFunctionOwnerContract = PythonFunctionOwner(tree, node_index)

    def nodes(self) -> list[ast.AST]:
        """Responsibilities: _collection Python function declarations_."""
        return list(self._function_nodes())

    def source_nodes(self) -> list[ast.AST]:
        """Responsibilities: _source function selection_."""
        return [node for node in self._function_nodes() if type(self._owner.resolve(node)) is not ast.ClassDef]

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

    def owner_name(self, node: ast.AST) -> str:
        """Responsibilities: _callable enclosing owner name_."""
        owner = self._owner.resolve(node)
        if type(owner) is ast.Module:
            return ""
        if type(owner) is ast.FunctionDef:
            return owner.name
        if type(owner) is ast.AsyncFunctionDef:
            return owner.name
        if type(owner) is ast.ClassDef:
            return owner.name
        return ""
