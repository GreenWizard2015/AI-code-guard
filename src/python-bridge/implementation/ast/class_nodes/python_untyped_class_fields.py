from __future__ import annotations

import ast

from implementation.ast.class_nodes.python_slot_statement import PythonSlotStatement
from implementation.ast.protocols import (
    PythonAstNodeIndexContract,
    PythonInstanceFieldNamesContract,
    PythonSlotFieldsContract,
)
from implementation.types import JsonObject


class PythonUntypedClassFields:
    """Responsibilities: _untyped class assignments_, _untyped method assignments_."""

    def _untyped_class_fields(self, assignment: ast.stmt) -> list[JsonObject]:
        """Responsibilities: _untyped class assignment collection_."""
        if type(assignment) is not ast.Assign:
            return []
        statement = PythonSlotStatement(assignment)
        if statement.metadata():
            return []
        return [
            {"line": assignment.lineno - 1, "name": target.id}
            for target in assignment.targets
            if type(target) is ast.Name
        ]

    def _untyped_assignment_fields(self, assignment: ast.Assign) -> list[JsonObject]:
        """Responsibilities: _untyped instance assignment collection_."""
        fields: list[JsonObject] = []
        for target in assignment.targets:
            if type(target) is not ast.Attribute:
                continue
            if not self._instance_field_names.instance_target(target):
                continue
            fields.append({"line": assignment.lineno - 1, "name": target.attr})
        return fields

    def _method_body_fields(self, statements: list[ast.stmt]) -> list[JsonObject]:
        """Responsibilities: _untyped method field collection_."""
        fields: list[JsonObject] = []
        for statement in statements:
            for node in self._node_index.nodes(statement):
                if type(node) is ast.Assign:
                    fields.extend(self._untyped_assignment_fields(node))
        return fields

    def _typed_names(self, typed_fields: list[JsonObject]) -> set[str]:
        """Responsibilities: _typed field name exclusion_."""
        names: set[str] = set()
        for field in typed_fields:
            name = field["name"]
            if type(name) is str and field["type"]:
                names.add(name)
        names.update(self._instance_field_names.names())
        return names

    def _class_field_candidates(self) -> list[JsonObject]:
        """Responsibilities: _untyped class field candidates_."""
        candidates: list[JsonObject] = []
        for item in self._node.body:
            candidates.extend(self._untyped_class_fields(item))
        return candidates

    def _append_missing(
        self,
        fields: list[JsonObject],
        known_names: set[str],
        candidates: list[JsonObject],
        excluded_names: set[str],
    ) -> None:
        """Responsibilities: _untyped field deduplication_."""
        for field in candidates:
            name = field["name"]
            if type(name) is not str:
                continue
            if name in excluded_names or name in known_names:
                continue
            known_names.add(name)
            fields.append(field)

    def __init__(
        self,
        node: ast.ClassDef,
        node_index: PythonAstNodeIndexContract,
        instance_field_names: PythonInstanceFieldNamesContract,
        slot_fields: PythonSlotFieldsContract,
    ) -> None:
        """Responsibilities: _untyped field candidate dependencies_."""
        self._node: ast.ClassDef = node
        self._node_index: PythonAstNodeIndexContract = node_index
        self._instance_field_names: PythonInstanceFieldNamesContract = instance_field_names
        self._slot_fields: PythonSlotFieldsContract = slot_fields

    def method_fields(self, candidate: ast.stmt) -> list[JsonObject]:
        """Responsibilities: _untyped instance field selection_."""
        match candidate:
            case ast.FunctionDef(body=statements) | ast.AsyncFunctionDef(
                body=statements,
            ):
                return self._method_body_fields(statements)
            case _:
                return []

    def collect(self, typed_fields: list[JsonObject]) -> list[JsonObject]:
        """Responsibilities: _untyped field aggregation_."""
        typed_names = self._typed_names(typed_fields)
        fields = self._slot_fields.untyped_fields(typed_names)
        known_names: set[str] = set()
        for field in fields:
            name = field["name"]
            if type(name) is str:
                known_names.add(name)
        self._append_missing(fields, known_names, self._class_field_candidates(), set())
        method_fields = [field for item in self._node.body for field in self.method_fields(item)]
        self._append_missing(fields, known_names, method_fields, typed_names)
        return fields
