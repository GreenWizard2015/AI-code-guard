from __future__ import annotations

import ast

from implementation.ast.constants import CLASS_BUILTIN_TYPES
from implementation.types import JsonObject

NodeData = JsonObject


class PythonClassNodeFields:
    """Responsibilities: _extraction typed untyped instance_."""

    def _value_name(self, value: ast.expr) -> str:
        """Responsibilities: _resolution source name represented_."""
        if type(value) is ast.Name:
            return value.id
        return ""

    def _annotated_field(self, item: ast.AnnAssign) -> NodeData:
        """Responsibilities: _normalization annotated class field_."""
        annotation = item.annotation
        type_kind = "named"
        if type(annotation) is ast.Subscript:
            type_kind = "generic"
        is_builtin_name = type(annotation) is ast.Name
        if is_builtin_name and annotation.id in CLASS_BUILTIN_TYPES:
            type_kind = "basic"
        return {
            "line": item.lineno - 1,
            "name": item.target.id,
            "value_name": self._value_name(item.value),
            "type": ast.unparse(annotation),
            "type_kind": type_kind,
        }

    def _assigned_fields(self, item: ast.Assign) -> list[NodeData]:
        """Responsibilities: _normalization fields declared assignment_."""
        fields: list[NodeData] = []
        for target in item.targets:
            if type(target) is ast.Name:
                fields.append(
                    {
                        "line": item.lineno - 1,
                        "name": target.id,
                        "value_name": self._value_name(item.value),
                    }
                )
        return fields

    def _class_fields(self, item: ast.stmt) -> list[NodeData]:
        """Responsibilities: _collection typed class fields_."""
        is_named_annotation = type(item) is ast.AnnAssign
        if is_named_annotation and type(item.target) is ast.Name:
            return [self._annotated_field(item)]
        if type(item) is ast.Assign:
            return self._assigned_fields(item)
        return []

    def _untyped_class_fields(self, item: ast.stmt) -> list[NodeData]:
        """Responsibilities: _collection untyped class fields_."""
        if type(item) is not ast.Assign:
            return []
        return [
            {"line": item.lineno - 1, "name": target.id}
            for target in item.targets
            if type(target) is ast.Name
        ]

    def _untyped_instance_fields(self, item: ast.AST) -> list[NodeData]:
        """Responsibilities: _collection untyped instance fields_."""
        fields: list[NodeData] = []
        for nested in ast.walk(item):
            if type(nested) is ast.Assign:
                fields.extend(
                    {"line": nested.lineno - 1, "name": target.attr}
                    for target in nested.targets
                    if self._instance_field_target(target)
                )
        return fields

    def _instance_field_target(self, target: ast.AST) -> bool:
        """Responsibilities: _classification assignment target instance_."""
        is_attribute = type(target) is ast.Attribute
        if not is_attribute or type(target.value) is not ast.Name:
            return False
        return target.value.id in ("self", "cls")

    def __init__(self, node: ast.ClassDef) -> None:
        """Responsibilities: _initialization class node usage_."""
        self.node: ast.ClassDef = node

    def fields(self) -> list[NodeData]:
        """Responsibilities: _collection typed class instance_."""
        fields: list[NodeData] = []
        for item in self.node.body:
            fields.extend(self._class_fields(item))
        return fields

    def untyped_fields(self) -> list[NodeData]:
        """Responsibilities: _collection untyped class instance_."""
        fields: list[NodeData] = []
        for item in self.node.body:
            fields.extend(self._untyped_class_fields(item))
            if type(item) in (ast.FunctionDef, ast.AsyncFunctionDef):
                fields.extend(self._untyped_instance_fields(item))
        return fields
