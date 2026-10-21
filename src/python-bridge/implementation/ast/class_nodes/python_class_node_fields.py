from __future__ import annotations

import ast

from implementation.ast.constants import CLASS_BUILTIN_TYPES
from implementation.ast.class_nodes.python_slot_fields import PythonSlotFields
from implementation.ast.protocols import PythonAstNodeIndexContract
from implementation.references.protocols import PythonContainerAliasesContract
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

    def _annotated_field(
        self, item: ast.AnnAssign, class_scope: bool = True
    ) -> NodeData:
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
            "class_scope": class_scope,
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
                        "class_scope": True,
                        "visibility": self._visibility(target.id),
                    }
                )
        return fields

    def _class_fields(self, item: ast.stmt) -> list[NodeData]:
        """Responsibilities: _collection typed class fields_."""
        if self.slot_fields.metadata_statement(item):
            return []
        is_named_annotation = type(item) is ast.AnnAssign
        if is_named_annotation:
            if type(item.target) is ast.Name:
                is_slot = item.target.id in self.slot_fields.fields()
                return [self._annotated_field(item, not is_slot)]
        if type(item) is ast.Assign:
            return self._assigned_fields(item)
        return []

    def _untyped_class_fields(self, item: ast.stmt) -> list[NodeData]:
        """Responsibilities: _collection untyped class fields_."""
        if type(item) is not ast.Assign:
            return []
        if self.slot_fields.metadata_statement(item):
            return []
        fields: list[NodeData] = []
        for target in item.targets:
            if type(target) is ast.Name:
                fields.append({"line": item.lineno - 1, "name": target.id})
        return fields

    def _untyped_item_fields(
        self, item: ast.stmt, typed_names: set[str]
    ) -> list[NodeData]:
        """Responsibilities: _untyped field candidates_."""
        fields = self._untyped_class_fields(item)
        if type(item) in (ast.FunctionDef, ast.AsyncFunctionDef):
            fields.extend(
                field
                for field in self._untyped_instance_fields(item)
                if field["name"] not in typed_names
            )
        return fields

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
        module_body: list[ast.stmt],
    ) -> None:
        """Responsibilities: _initialization class node usage_."""
        self.node: ast.ClassDef = node
        self.container_aliases: PythonContainerAliasesContract = container_aliases
        self.node_index: PythonAstNodeIndexContract = node_index
        self.slot_fields: PythonSlotFields = PythonSlotFields(node, module_body)

    def fields(self) -> list[NodeData]:
        """Responsibilities: _collection typed class instance_."""
        fields: list[NodeData] = []
        for item in self.node.body:
            fields.extend(self._class_fields(item))
        known_names = {field["name"] for field in fields}
        for name, line in self.slot_fields.fields().items():
            if name not in known_names:
                fields.append(
                    {
                        "line": line,
                        "name": name,
                        "value_name": "",
                        "type": "",
                        "type_kind": "basic",
                        "readonly": False,
                        "class_variable": False,
                        "class_scope": False,
                        "visibility": self._visibility(name),
                    }
                )
        return fields

    def untyped_fields(self) -> list[NodeData]:
        """Responsibilities: _collection untyped class instance_."""
        typed_names = {field["name"] for field in self.fields() if field["type"]}
        fields = self.slot_fields.untyped_fields(typed_names)
        known_names = {field["name"] for field in fields}
        for item in self.node.body:
            for field in self._untyped_item_fields(item, typed_names):
                if field["name"] in known_names:
                    continue
                known_names.add(field["name"])
                fields.append(field)
        return fields
