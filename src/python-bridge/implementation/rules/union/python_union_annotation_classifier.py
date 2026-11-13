from __future__ import annotations

import ast

from implementation.ast.protocols import PythonAstNodeIndexContract
from implementation.rules.constants import PYTHON_UNION_NAME
from implementation.rules.protocols import PythonTypingAliasesContract


class PythonUnionAnnotationClassifier:
    """Responsibilities: _composite annotation flattening_, _optional type classification_."""

    def _annotation_name(self, name_expression: ast.expr) -> str:
        """Responsibilities: _annotation expression name resolution_."""
        name = self._python_typing_aliases.expression_name(name_expression)
        if name:
            return name
        if type(name_expression) is ast.Name:
            return name_expression.id
        if type(name_expression) is ast.Attribute:
            return name_expression.attr
        return ""

    def _flatten_types(
        self,
        node: ast.expr,
        operation: type[ast.operator],
    ) -> list[ast.expr]:
        """Responsibilities: _binary annotation type flattening_."""
        if type(node) is not ast.BinOp or type(node.op) is not operation:
            return [node]
        flattened = self._flatten_types(node.left, operation)
        flattened.extend(self._flatten_types(node.right, operation))
        return flattened

    def _annotation_union_types(self, union_annotation: ast.expr) -> list[ast.expr]:
        """Responsibilities: _annotation union member collection_."""
        if type(union_annotation) is ast.BinOp and type(union_annotation.op) is ast.BitOr:
            return self._flatten_types(union_annotation, ast.BitOr)
        if type(union_annotation) is not ast.Subscript:
            return [union_annotation]
        name = self._annotation_name(union_annotation.value)
        if not self._python_typing_aliases.matches_union(name):
            return [union_annotation]
        if type(union_annotation.slice) is ast.Tuple:
            members: list[ast.expr] = []
            members.extend(union_annotation.slice.elts)
            return members
        return [union_annotation.slice]

    def _annotation_intersection_types(
        self,
        intersection_annotation: ast.expr,
    ) -> list[ast.expr]:
        """Responsibilities: _annotation intersection member collection_."""
        if type(intersection_annotation) is ast.BinOp and type(intersection_annotation.op) is ast.BitAnd:
            return self._flatten_types(intersection_annotation, ast.BitAnd)
        return [intersection_annotation]

    def __init__(
        self,
        node_index: PythonAstNodeIndexContract,
        python_typing_aliases: PythonTypingAliasesContract,
    ) -> None:
        """Responsibilities: _union annotation classification initialization_."""
        self._node_index: PythonAstNodeIndexContract = node_index
        self._python_typing_aliases: PythonTypingAliasesContract = python_typing_aliases

    def annotation_composite_types(
        self,
        composite_annotation: ast.expr,
    ) -> list[ast.expr]:
        """Responsibilities: _composite annotation member collection_."""
        union_values = self._annotation_union_types(composite_annotation)
        if len(union_values) > 1:
            return union_values
        return self._annotation_intersection_types(composite_annotation)

    def optional_type(self, optional_annotation: ast.AST) -> bool:
        """Responsibilities: _optional annotation types identification_."""
        if type(optional_annotation) is not ast.Subscript:
            return False
        name = self._annotation_name(optional_annotation.value)
        if self._python_typing_aliases.matches_optional(name):
            return optional_annotation.slice is not None
        if name != PYTHON_UNION_NAME or type(optional_annotation.slice) is not ast.Tuple:
            return False
        values = list(optional_annotation.slice.elts)
        contains_none = any(type(item) is ast.Constant and item.value is None for item in values)
        contains_value = any(not (type(item) is ast.Constant and item.value is None) for item in values)
        return contains_none and contains_value

    def nullish_type(self, result_annotation: ast.AST) -> bool:
        """Responsibilities: _nullish annotation types identification_."""
        if type(result_annotation) is ast.Constant and result_annotation.value is None:
            return True
        if type(result_annotation) is ast.Name:
            return result_annotation.id in {"Never", "NoReturn", "undefined"}
        return False

    def contains_union(self, annotation: ast.expr) -> bool:
        """Responsibilities: _composite annotation identification_."""
        for item in self._node_index.nodes(annotation):
            match item:
                case ast.expr() as expression:
                    if len(self.annotation_composite_types(expression)) > 1:
                        return True
        return False

    def nodes(self, annotation: ast.AST) -> list[ast.AST]:
        """Responsibilities: _annotation node traversal_."""
        return list(self._node_index.nodes(annotation))
