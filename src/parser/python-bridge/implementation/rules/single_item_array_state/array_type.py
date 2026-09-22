from __future__ import annotations
from typing import Any

import ast


class PythonArrayTypeInspector:
    """Responsibilities: _resolution Python array type_, _array nodes identification_."""

    def _value_name(self, value: ast.AST) -> str:
        """Responsibilities: _resolution annotation value name_."""
        if type(value) is ast.Name:
            return value.id
        if type(value) is ast.Attribute:
            return value.attr
        return ""

    def __init__(self, array_type_names: frozenset[str]) -> None:
        """Responsibilities: _initialization known array type_."""
        self.array_type_names: Any = array_type_names

    def type_name(self, node: ast.AST) -> str:
        """Responsibilities: _resolution annotation type name_."""
        if type(node) is not ast.Subscript:
            return ""
        return self._value_name(node.value)

    def array_type(self, node: ast.AST) -> bool:
        """Responsibilities: _reporting annotation array type_."""
        return self.type_name(node) in self.array_type_names
