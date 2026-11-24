from __future__ import annotations

import ast

from implementation.ast.protocols import PythonAstNodeIndexContract


class PythonAstNodeSelection:
    """Responsibilities: _class declaration selection_, _expression selection_."""

    _node_index: PythonAstNodeIndexContract

    def __init__(self, node_index: PythonAstNodeIndexContract) -> None:
        """Responsibilities: _AST node selection dependency_."""
        self._node_index = node_index

    def class_definitions(self, root: ast.AST) -> list[ast.ClassDef]:
        """Responsibilities: _class declaration selection_."""
        definitions: list[ast.ClassDef] = []
        for node in self._node_index.nodes(root):
            match node:
                case ast.ClassDef() as definition:
                    definitions.append(definition)
        return definitions

    def expressions(self, root: ast.AST) -> list[ast.expr]:
        """Responsibilities: _expression selection_."""
        expressions: list[ast.expr] = []
        for node in self._node_index.nodes(root):
            match node:
                case ast.expr() as expression:
                    expressions.append(expression)
        return expressions
