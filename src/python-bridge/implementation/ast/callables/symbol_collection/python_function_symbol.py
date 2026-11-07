from __future__ import annotations

import ast

from implementation.ast.protocols import (
    PythonAstNodeIndexContract,
    PythonCallableArgumentsContract,
)
from implementation.rules.constants import PYTHON_FUNCTION_KIND
from implementation.types import JsonObject

PythonCallableNode = ast.FunctionDef | ast.AsyncFunctionDef


class PythonFunctionSymbol:
    """Responsibilities: _function symbol identity_, _function visibility_."""

    def _parent(self) -> ast.AST:
        """Responsibilities: _function declaration parent lookup_."""
        parents = self._node_index.parents(self._node)
        if not parents:
            return self._tree
        return parents[-1]

    def __init__(
        self,
        node: PythonCallableNode,
        tree: ast.AST,
        node_index: PythonAstNodeIndexContract,
        callable_arguments: PythonCallableArgumentsContract,
    ) -> None:
        """Responsibilities: _function symbol initialization_."""
        self._node: PythonCallableNode = node
        self._tree: ast.AST = tree
        self._node_index: PythonAstNodeIndexContract = node_index
        self._callable_arguments: PythonCallableArgumentsContract = callable_arguments

    def kind(self) -> str:
        """Responsibilities: _function kind classification_."""
        if type(self._parent()) is ast.ClassDef:
            return "method"
        return PYTHON_FUNCTION_KIND

    def visibility(self) -> str:
        """Responsibilities: _function visibility classification_."""
        if self.kind() != "method":
            return "public"
        return self._callable_arguments.for_callable(self._node).visibility()

    def module_scope(self) -> bool:
        """Responsibilities: _module-level function classification_."""
        current = self._parent()
        while current is not self._tree:
            if (
                type(current) is ast.FunctionDef
                or type(current) is ast.AsyncFunctionDef
                or type(current) is ast.ClassDef
            ):
                return False
            parents = self._node_index.parents(current)
            if not parents:
                return False
            current = parents[-1]
        return True

    def record(self) -> JsonObject:
        """Responsibilities: _function symbol record_."""
        kind = self.kind()
        node = self._node
        is_module_function = False
        if kind == PYTHON_FUNCTION_KIND:
            is_module_function = self.module_scope()
        return {
            "name": node.name,
            "line": node.lineno - 1,
            "kind": kind,
            "visibility": self.visibility(),
            "is_module_function": is_module_function,
        }
