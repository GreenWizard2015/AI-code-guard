from __future__ import annotations

import ast
from collections.abc import Mapping
from contextvars import ContextVar

from implementation.ast.protocols import PythonAstNodeIndexContract
from implementation.types import PythonGenericNames


class AnnotationNames:
    """Responsibilities: _annotation name resolution_, _constructor alias resolution_."""

    _node_index: PythonAstNodeIndexContract
    _generics: ContextVar[PythonGenericNames]

    def _expression_children(self, parent: ast.AST) -> list[ast.expr]:
        """Responsibilities: _annotation expression child selection_."""
        expressions: list[ast.expr] = []
        for child in self._node_index.children(parent):
            match child:
                case ast.expr():
                    expressions.append(child)
        return expressions

    def _string_children(self, source: str) -> list[ast.expr]:
        """Responsibilities: _string annotation expression parsing_."""
        try:
            parsed = ast.parse(source, mode="eval")
        except SyntaxError:
            return []
        if type(parsed) is not ast.Expression:
            return []
        return [parsed.body]

    def _generic_children(self, current: ast.Subscript) -> list[ast.expr]:
        """Responsibilities: _transparent generic annotation children_."""
        if type(current.value) is not ast.Name:
            return []
        if current.value.id not in self._generics.get():
            return []
        if type(current.slice) is ast.Tuple:
            return self._expression_children(current.slice)
        return [current.slice]

    def _annotation_children(self, current: ast.expr) -> list[ast.expr]:
        """Responsibilities: _annotation traversal step_."""
        if type(current) is ast.Constant and type(current.value) is str:
            return self._string_children(current.value)
        if type(current) is ast.BinOp and type(current.op) is ast.BitOr:
            return self._expression_children(current)
        if type(current) is ast.Subscript:
            return self._generic_children(current)
        return []

    def __init__(self, node_index: PythonAstNodeIndexContract) -> None:
        """Responsibilities: _annotation traversal state_."""
        self._node_index = node_index
        self._generics = ContextVar("annotation_generics", default=frozenset())

    def annotation_name(
        self,
        annotation: ast.expr,
        aliases: Mapping[str, str],
        generics: set[str],
    ) -> str:
        """Responsibilities: _recursive annotation name normalization_."""
        token = self._generics.set(frozenset(generics))
        try:
            pending: list[ast.expr] = [annotation]
            while pending:
                current = pending.pop()
                if type(current) is ast.Name:
                    return aliases.get(current.id, current.id)
                pending.extend(reversed(self._annotation_children(current)))
            return ""
        finally:
            self._generics.reset(token)

    def resolve_constructor(
        self,
        value: ast.AST,
        class_names: set[str],
        constructor_aliases: Mapping[str, str],
    ) -> str:
        """Responsibilities: _constructor expression name resolution_."""
        if type(value) is not ast.Call or type(value.func) is not ast.Name:
            return ""
        if value.func.id not in class_names:
            return ""
        return constructor_aliases.get(value.func.id, value.func.id)
