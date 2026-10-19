from __future__ import annotations

import ast

from implementation.ast.constants import CLASS_BUILTIN_TYPES
from implementation.protocols import PythonAstNodeIndexContract
from implementation.references.aliases.protocols import PythonContainerAliasesContract
from implementation.types import JsonObject
from implementation.rules.constants import PYTHON_CLASSVAR_NAME

NodeData = JsonObject


class PythonClassNodeFields:
    """Responsibilities: _field visibility analysis_, _field type normalization_."""

    def _visibility(self, name: str) -> str:
        """Responsibilities: _classification field visibility_."""
        if not name.startswith("_"):
            return "public"
        if name.startswith("__"):
            if name.endswith("__"):
                return "public"
        return "private"

    def _value_name(self, value: ast.expr) -> str:
        """Responsibilities: _resolution source name represented_."""
        if type(value) is ast.Name:
            return value.id
        return ""

    def _annotation_root(self, annotation: ast.AST) -> ast.AST:
        """Responsibilities: _annotation root resolution_."""
        current = annotation
        while type(current) is ast.Subscript:
            resolved = self.container_aliases.container_values.container_value(current)
            if resolved.found():
                current = resolved.expression_node()
                continue
            current = current.value
        return current

    def _is_class_variable(self, annotation: ast.AST) -> bool:
        """Responsibilities: _ClassVar annotation classification_."""
        root = self._annotation_root(annotation)
        if type(root) is ast.Name:
            return root.id == PYTHON_CLASSVAR_NAME
        if type(root) is not ast.Attribute:
            return False
        return root.attr == PYTHON_CLASSVAR_NAME

    def _annotated_field(self, item: ast.AnnAssign) -> NodeData:
        """Responsibilities: _normalization annotated class field_."""
        annotation = item.annotation
        type_kind = "named"
        if type(annotation) is ast.Subscript:
            type_kind = "generic"
        is_builtin_name = type(annotation) is ast.Name
        if is_builtin_name:
            if annotation.id in CLASS_BUILTIN_TYPES:
                type_kind = "basic"
        return {
            "line": item.lineno - 1,
            "name": item.target.id,
            "value_name": self._value_name(item.value),
            "type": ast.unparse(annotation),
            "type_kind": type_kind,
            "readonly": False,
            "class_variable": self._is_class_variable(annotation),
            "visibility": self._visibility(item.target.id),
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
                        "type": "",
                        "type_kind": "basic",
                        "readonly": False,
                        "class_variable": False,
                        "visibility": self._visibility(target.id),
                    }
                )
        return fields

    def _class_fields(self, item: ast.stmt) -> list[NodeData]:
        """Responsibilities: _collection typed class fields_."""
        is_named_annotation = type(item) is ast.AnnAssign
        if is_named_annotation:
            if type(item.target) is ast.Name:
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
        for nested in self.node_index.nodes(item):
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
        if not is_attribute:
            return False
        if type(target.value) is not ast.Name:
            return False
        return target.value.id in ("self", "cls")

    def __init__(
        self,
        node: ast.ClassDef,
        container_aliases: PythonContainerAliasesContract,
        node_index: PythonAstNodeIndexContract,
    ) -> None:
        """Responsibilities: _initialization class node usage_."""
        self.node: ast.ClassDef = node
        self.container_aliases: PythonContainerAliasesContract = container_aliases
        self.node_index: PythonAstNodeIndexContract = node_index

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
