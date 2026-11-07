from __future__ import annotations

import ast

from implementation.ast.callables.callable_argument_context import (
    CallableArgumentContext,
)
from implementation.ast.constants import STRUCTURAL_TYPE_NAMES
from implementation.ast.protocols import (
    PythonAstNodeIndexContract,
    PythonCallableArgumentContextContract,
)
from implementation.references.protocols import PythonScopedTypeAliasesContract


class CallableArguments:
    """Responsibilities: _callable argument context creation_, _structural type classification_."""

    def __init__(
        self,
        node_index: PythonAstNodeIndexContract,
        type_aliases: PythonScopedTypeAliasesContract,
    ) -> None:
        """Responsibilities: _callable argument analysis dependencies_."""
        self._node_index: PythonAstNodeIndexContract = node_index
        self._type_aliases: PythonScopedTypeAliasesContract = type_aliases

    def for_callable(self, node: ast.AST) -> PythonCallableArgumentContextContract:
        """Responsibilities: _callable signature ownership_."""
        match node:
            case ast.FunctionDef() | ast.AsyncFunctionDef():
                arguments: list[ast.arg] = [
                    *node.args.posonlyargs,
                    *node.args.args,
                    *node.args.kwonlyargs,
                ]
                if node.args.vararg:
                    arguments.append(node.args.vararg)
                if node.args.kwarg:
                    arguments.append(node.args.kwarg)
            case _:
                raise TypeError(
                    f"Expected a function AST node, received {type(node).__name__}.",
                )
        return CallableArgumentContext(
            node,
            self._node_index,
            self._type_aliases,
            arguments,
        )

    def structural_type(self, node: ast.AST) -> bool:
        """Responsibilities: _classification AST expression structural_."""
        if type(node) is ast.BinOp:
            return type(node.op) is ast.BitOr
        if type(node) is ast.Name:
            return node.id[:1].isupper()
        if type(node) is not ast.Subscript or type(node.value) is not ast.Name:
            return False
        return node.value.id in STRUCTURAL_TYPE_NAMES
