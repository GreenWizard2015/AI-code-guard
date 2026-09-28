from __future__ import annotations

import ast

from implementation.rules.protocols import PythonTypingAliasesProtocol


class PythonUnionAnnotationShapes:
    """Responsibilities: _union annotation shape analysis_."""

    def _union_types(self, node: ast.expr) -> list[ast.expr]:
        """Responsibilities: _union expression flattening_."""
        if type(node) is not ast.BinOp or type(node.op) is not ast.BitOr:
            return [node]
        return self._union_types(node.left) + self._union_types(node.right)

    def _intersection_types(self, node: ast.expr) -> list[ast.expr]:
        """Responsibilities: _intersection expression flattening_."""
        if type(node) is not ast.BinOp or type(node.op) is not ast.BitAnd:
            return [node]
        return self._intersection_types(node.left) + self._intersection_types(
            node.right
        )

    def _composite_children(
        self, node: ast.expr, candidates: list[ast.expr]
    ) -> list[ast.expr]:
        """Responsibilities: _nested composite member collection_."""
        if type(node) is not ast.BinOp:
            return []
        candidate_ids = {id(item) for item in candidates}
        return [
            child for child in (node.left, node.right) if id(child) in candidate_ids
        ]

    def __init__(self, typing_aliases: PythonTypingAliasesProtocol) -> None:
        """Responsibilities: _union shape analysis initialization_."""
        self.typing_aliases: PythonTypingAliasesProtocol = typing_aliases

    def annotation_union_types(self, node: ast.AST) -> list[ast.AST]:
        """Responsibilities: _annotation union member collection_."""
        if type(node) is ast.BinOp and type(node.op) is ast.BitOr:
            return self._union_types(node)
        if type(node) is not ast.Subscript:
            return [node]
        if not self.typing_aliases.matches_union(self.subscript_name(node.value)):
            return [node]
        if type(node.slice) is ast.Tuple:
            return list(node.slice.elts)
        return [node.slice]

    def annotation_intersection_types(self, node: ast.AST) -> list[ast.AST]:
        """Responsibilities: _annotation intersection member collection_."""
        if type(node) is ast.BinOp and type(node.op) is ast.BitAnd:
            return self._intersection_types(node)
        return [node]

    def annotation_composite_types(self, node: ast.AST) -> list[ast.AST]:
        """Responsibilities: _composite annotation member collection_."""
        union_types = self.annotation_union_types(node)
        if len(union_types) > 1:
            return union_types
        return self.annotation_intersection_types(node)

    def subscript_name(self, value: ast.AST) -> str:
        """Responsibilities: _subscript annotation name resolution_."""
        resolved = self.typing_aliases.expression_name(value)
        if resolved:
            return resolved
        if type(value) is ast.Name:
            return value.id
        if type(value) is ast.Attribute:
            return value.attr
        return ""
