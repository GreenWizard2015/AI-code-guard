from __future__ import annotations

import ast

from implementation.ast.protocols import PythonAstNodeIndexContract
from implementation.rules.protocols import PythonTypingAliasesContract
from implementation.references.protocols import PythonContainerAliasesContract
from implementation.rules.constants import PYTHON_UNION_NAME


class PythonUnionAnnotationClassifier:
    """Responsibilities: _composite annotation flattening_, _optional type classification_."""

    def _annotation_name(self, value: ast.AST) -> str:
        """Responsibilities: _annotation expression name resolution_."""
        name = self.python_typing_aliases.expression_name(value, self.container_aliases)
        if name:
            return name
        if type(value) is ast.Name:
            return value.id
        if type(value) is ast.Attribute:
            return value.attr
        return ""

    def _flatten_types(
        self, node: ast.expr, operation: type[ast.operator]
    ) -> list[ast.expr]:
        """Responsibilities: _binary annotation type flattening_."""
        if type(node) is not ast.BinOp or type(node.op) is not operation:
            return [node]
        return self._flatten_types(node.left, operation) + self._flatten_types(
            node.right, operation
        )

    def _annotation_union_types(self, node: ast.AST) -> list[ast.AST]:
        """Responsibilities: _annotation union member collection_."""
        if type(node) is ast.BinOp and type(node.op) is ast.BitOr:
            return self._flatten_types(node, ast.BitOr)
        if type(node) is not ast.Subscript:
            return [node]
        name = self._annotation_name(node.value)
        if not self.python_typing_aliases.matches_union(name):
            return [node]
        if type(node.slice) is ast.Tuple:
            return list(node.slice.elts)
        return [node.slice]

    def _annotation_intersection_types(self, node: ast.AST) -> list[ast.AST]:
        """Responsibilities: _annotation intersection member collection_."""
        if type(node) is ast.BinOp and type(node.op) is ast.BitAnd:
            return self._flatten_types(node, ast.BitAnd)
        return [node]

    def __init__(
        self,
        node_index: PythonAstNodeIndexContract,
        python_typing_aliases: PythonTypingAliasesContract,
        container_aliases: PythonContainerAliasesContract,
    ) -> None:
        """Responsibilities: _union annotation classification initialization_."""
        self.node_index: PythonAstNodeIndexContract = node_index
        self.python_typing_aliases: PythonTypingAliasesContract = python_typing_aliases
        self.container_aliases: PythonContainerAliasesContract = container_aliases

    def annotation_composite_types(self, node: ast.AST) -> list[ast.AST]:
        """Responsibilities: _composite annotation member collection_."""
        union_values = self._annotation_union_types(node)
        if len(union_values) > 1:
            return union_values
        return self._annotation_intersection_types(node)

    def optional_type(self, value: ast.AST) -> bool:
        """Responsibilities: _optional annotation types identification_."""
        if type(value) is not ast.Subscript:
            return False
        name = self._annotation_name(value.value)
        if self.python_typing_aliases.matches_optional(name):
            return value.slice is not None
        if name != PYTHON_UNION_NAME or type(value.slice) is not ast.Tuple:
            return False
        values = list(value.slice.elts)
        contains_none = any(
            type(item) is ast.Constant and item.value is None for item in values
        )
        contains_value = any(
            not (type(item) is ast.Constant and item.value is None) for item in values
        )
        return contains_none and contains_value

    def nullish_type(self, value: ast.AST) -> bool:
        """Responsibilities: _nullish annotation types identification_."""
        if type(value) is ast.Constant and value.value is None:
            return True
        if type(value) is ast.Name:
            return value.id in {"Never", "NoReturn", "undefined"}
        return False

    def contains_union(self, annotation: ast.AST) -> bool:
        """Responsibilities: _composite annotation identification_."""
        for item in self.node_index.nodes(annotation):
            if len(self.annotation_composite_types(item)) > 1:
                return True
        return False

    def nodes(self, annotation: ast.AST) -> list[ast.AST]:
        """Responsibilities: _annotation node traversal_."""
        return list(self.node_index.nodes(annotation))
