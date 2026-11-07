from __future__ import annotations

import ast

from implementation.ast.constants import CLASS_BUILTIN_TYPES
from implementation.references.protocols import PythonContainerAliasesContract
from implementation.rules.constants import PYTHON_CLASSVAR_NAME
from implementation.types import JsonObject


class PythonClassFieldRecord:
    """Responsibilities: _field scope classification_, _field metadata_."""

    def _annotation_root(self, annotation: ast.AST) -> ast.AST:
        """Responsibilities: _annotation root resolution_."""
        current = annotation
        while type(current) is ast.Subscript:
            resolved = self._container_aliases.container_values().container_value(current)
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

    def _annotation_kind(self, annotation: ast.expr) -> str:
        """Responsibilities: _field annotation category_."""
        if type(annotation) is ast.Subscript:
            return "generic"
        if type(annotation) is ast.Name:
            if annotation.id in CLASS_BUILTIN_TYPES:
                return "basic"
        return "named"

    def _value_name(self, value: ast.expr) -> str:
        """Responsibilities: _source value name resolution_."""
        if type(value) is ast.Name:
            return value.id
        return ""

    def __init__(self, container_aliases: PythonContainerAliasesContract) -> None:
        """Responsibilities: _field record dependency ownership_."""
        self._container_aliases: PythonContainerAliasesContract = container_aliases

    def visibility(self, name: str) -> str:
        """Responsibilities: _field visibility classification_."""
        if not name.startswith("_"):
            return "public"
        if name.startswith("__"):
            if name.endswith("__"):
                return "public"
        return "private"

    def field_name(self, field: JsonObject) -> str:
        """Responsibilities: _field name extraction_."""
        name = field["name"]
        if type(name) is not str:
            raise TypeError("normalized field name must be text")
        return name

    def annotated_field(
        self,
        item: ast.AnnAssign,
        field_name: str,
        class_scope: bool = True,
    ) -> JsonObject:
        """Responsibilities: _annotated field record construction_."""
        annotation = item.annotation
        value_name = ""
        if item.value is not None:
            value_name = self._value_name(item.value)
        class_variable = False
        if class_scope:
            class_variable = self._is_class_variable(annotation)
        return {
            "line": item.lineno - 1,
            "name": field_name,
            "value_name": value_name,
            "type": ast.unparse(annotation),
            "type_kind": self._annotation_kind(annotation),
            "readonly": False,
            "class_variable": class_variable,
            "class_scope": class_scope,
            "visibility": self.visibility(field_name),
        }

    def instance_field(self, line: int, value: ast.expr, field_name: str) -> JsonObject:
        """Responsibilities: _instance field record creation_."""
        return {
            "line": line - 1,
            "name": field_name,
            "value_name": self._value_name(value),
            "type": "",
            "type_kind": "basic",
            "readonly": False,
            "class_variable": False,
            "class_scope": False,
            "visibility": self.visibility(field_name),
        }

    def assigned_fields(self, item: ast.Assign) -> list[JsonObject]:
        """Responsibilities: _assigned class field records_."""
        return [
            {
                "line": item.lineno - 1,
                "name": target.id,
                "value_name": self._value_name(item.value),
                "type": "",
                "type_kind": "basic",
                "readonly": False,
                "class_variable": False,
                "class_scope": True,
                "visibility": self.visibility(target.id),
            }
            for target in item.targets
            if type(target) is ast.Name
        ]
