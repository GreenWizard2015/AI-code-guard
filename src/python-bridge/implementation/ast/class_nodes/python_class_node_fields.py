from __future__ import annotations

import ast

from implementation.ast.class_nodes.python_class_field_record import (
    PythonClassFieldRecord,
)
from implementation.ast.class_nodes.python_instance_field_names import (
    PythonInstanceFieldNames,
)
from implementation.ast.class_nodes.python_instance_field_records import (
    PythonInstanceFieldRecords,
)
from implementation.ast.class_nodes.python_slot_fields import PythonSlotFields
from implementation.ast.class_nodes.python_slot_statement import PythonSlotStatement
from implementation.ast.class_nodes.python_untyped_class_fields import (
    PythonUntypedClassFields,
)
from implementation.ast.protocols import (
    PythonClassFieldRecordContract,
    PythonClassNodeOptionsContract,
    PythonInstanceFieldRecordsContract,
    PythonSlotFieldsContract,
    PythonUntypedClassFieldsContract,
)
from implementation.types import JsonObject

NodeData = JsonObject


class PythonClassNodeFields:
    """Responsibilities: _class field collection_, _instance field collection_."""

    def _append_method_fields(
        self,
        fields: list[NodeData],
        known_instance_names: set[str],
    ) -> None:
        """Responsibilities: _instance field deduplication_."""
        for field in self._instance_field_records.for_class(self._node.body):
            name = self._field_records.field_name(field)
            if name not in known_instance_names:
                fields.append(field)
                known_instance_names.add(name)

    def _append_slot_fields(
        self,
        fields: list[NodeData],
        known_instance_names: set[str],
    ) -> None:
        """Responsibilities: _slot field completion_."""
        for name, line in self._slot_fields.fields().items():
            if name not in known_instance_names:
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
                        "visibility": self._field_records.visibility(name),
                    },
                )
                known_instance_names.add(name)

    def _class_fields(self, class_member: ast.stmt) -> list[NodeData]:
        """Responsibilities: _collection typed class fields_."""
        statement = PythonSlotStatement(class_member)
        if statement.metadata():
            return []
        if type(class_member) is ast.AnnAssign:
            if type(class_member.target) is ast.Name:
                is_slot = class_member.target.id in self._slot_fields.fields()
                return [
                    self._field_records.annotated_field(
                        class_member,
                        class_member.target.id,
                        not is_slot,
                    ),
                ]
        if type(class_member) is ast.Assign:
            return self._field_records.assigned_fields(class_member)
        return []

    def __init__(self, options: PythonClassNodeOptionsContract) -> None:
        """Responsibilities: _class field collection dependencies_."""
        self._node: ast.ClassDef = options.node
        instance_field_names = PythonInstanceFieldNames(
            options.node,
            options.node_index,
        )
        self._slot_fields: PythonSlotFieldsContract = PythonSlotFields(
            options.node,
            options.module_body,
        )
        self._field_records: PythonClassFieldRecordContract = PythonClassFieldRecord(
            options.container_aliases,
        )
        self._instance_field_records: PythonInstanceFieldRecordsContract = PythonInstanceFieldRecords(
            options.node_index,
            instance_field_names,
            self._field_records,
        )
        self._untyped_field_records: PythonUntypedClassFieldsContract = PythonUntypedClassFields(
            options.node,
            options.node_index,
            instance_field_names,
            self._slot_fields,
        )

    def fields(self) -> list[NodeData]:
        """Responsibilities: _collection typed class instance_."""
        fields = self.declared_fields()
        known_instance_names = {
            self._field_records.field_name(field) for field in fields if field["class_scope"] is False
        }
        self._append_method_fields(fields, known_instance_names)
        self._append_slot_fields(fields, known_instance_names)
        return fields

    def untyped_field_records(self) -> PythonUntypedClassFieldsContract:
        """Responsibilities: _untyped field classification access_."""
        return self._untyped_field_records

    def declared_fields(self) -> list[NodeData]:
        """Responsibilities: _class-level field declarations_."""
        fields: list[NodeData] = []
        for item in self._node.body:
            fields.extend(self._class_fields(item))
        return fields
