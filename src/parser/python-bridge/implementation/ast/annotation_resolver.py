from __future__ import annotations


from typing import Any, Mapping
import ast


class AnnotationNames:
    """Responsibilities: _normalization Python annotation names_."""

    def _string_annotation_name(
        self, value: str, aliases: Mapping[str, str], transparent_generics: set[str]
    ) -> str:
        """Responsibilities: _resolution string literal annotation_."""
        try:
            expression: Any = ast.parse(value, mode=self.string_annotation_mode).body
        except SyntaxError:
            return ""
        return self.annotation_name(expression, aliases, transparent_generics)

    def _union_annotation_name(
        self,
        annotation: ast.BinOp,
        aliases: Mapping[str, str],
        transparent_generics: set[str],
    ) -> str:
        """Responsibilities: _resolution first meaningful name_."""
        if type(annotation.op) is not ast.BitOr:
            return ""
        left_name: Any = self.annotation_name(
            annotation.left, aliases, transparent_generics
        )
        if left_name:
            return left_name
        return self.annotation_name(annotation.right, aliases, transparent_generics)

    def _generic_annotation_name(
        self,
        annotation: ast.Subscript,
        aliases: Mapping[str, str],
        transparent_generics: set[str],
    ) -> str:
        """Responsibilities: _resolution element name generic_."""
        if type(annotation.value) is not ast.Name:
            return ""
        if annotation.value.id not in transparent_generics:
            return ""
        values: Any
        if type(annotation.slice) is ast.Tuple:
            values = annotation.slice.elts
        else:
            values = [annotation.slice]
        for value in values:
            name: Any = self.annotation_name(value, aliases, transparent_generics)
            if name:
                return name
        return ""

    def __init__(self) -> None:
        """Responsibilities: _annotation normalization policy initialization_."""
        self.string_annotation_mode: Any = "eval"

    def annotation_name(
        self,
        annotation: ast.expr,
        aliases: Mapping[str, str],
        transparent_generics: set[str],
    ) -> str:
        """Responsibilities: _resolution normalization name Python_."""
        if type(annotation) is ast.Name:
            return aliases.get(annotation.id, annotation.id)
        is_string_constant = type(annotation) is ast.Constant
        if is_string_constant and type(annotation.value) is str:
            return self._string_annotation_name(
                annotation.value, aliases, transparent_generics
            )
        if type(annotation) is ast.BinOp:
            return self._union_annotation_name(
                annotation, aliases, transparent_generics
            )
        if type(annotation) is ast.Subscript:
            return self._generic_annotation_name(
                annotation, aliases, transparent_generics
            )
        return ""

    def constructor_name(
        self,
        value: ast.AST,
        class_names: set[str],
        aliases: Mapping[str, str],
    ) -> str:
        """Responsibilities: _resolution constructor expression its_."""
        if type(value) is not ast.Call:
            return ""
        if type(value.func) is not ast.Name:
            return ""
        if value.func.id not in class_names:
            return ""
        return aliases.get(value.func.id, value.func.id)
