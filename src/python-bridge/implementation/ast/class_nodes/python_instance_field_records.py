from __future__ import annotations

import ast

from implementation.ast.protocols import (
    PythonAstNodeIndexContract,
    PythonClassFieldRecordContract,
    PythonInstanceFieldNamesContract,
)
from implementation.types import JsonObject


class PythonInstanceFieldRecords:
    """Responsibilities: _method field discovery_, _instance field records_."""

    def _method_body_nodes(self, statements: list[ast.stmt]) -> list[ast.AST]:
        """Responsibilities: _method execution-scope traversal_."""
        pending: list[ast.AST] = list(reversed(statements))
        nodes: list[ast.AST] = []
        while pending:
            current = pending.pop()
            nodes.append(current)
            if type(current) in (
                ast.FunctionDef,
                ast.AsyncFunctionDef,
                ast.ClassDef,
                ast.Lambda,
            ):
                continue
            pending.extend(reversed(self._node_index.children(current)))
        return nodes

    def _assignment_fields(self, assignment: ast.stmt) -> list[JsonObject]:
        """Responsibilities: _assignment field record collection_."""
        if type(assignment) is ast.Assign:
            return self._assigned_instance_fields(assignment)
        if type(assignment) is ast.AnnAssign:
            return self._annotated_instance_fields(assignment)
        return []

    def _assigned_instance_fields(self, assignment: ast.Assign) -> list[JsonObject]:
        """Responsibilities: _assigned instance field records_."""
        fields: list[JsonObject] = []
        for target in assignment.targets:
            if type(target) is ast.Attribute:
                if self._instance_field_names.instance_target(target):
                    fields.append(
                        self._field_records.instance_field(
                            assignment.lineno,
                            assignment.value,
                            target.attr,
                        ),
                    )
        return fields

    def _annotated_instance_fields(self, assignment: ast.AnnAssign) -> list[JsonObject]:
        """Responsibilities: _annotated instance field records_."""
        target = assignment.target
        if type(target) is ast.Attribute:
            if self._instance_field_names.instance_target(target):
                return [
                    self._field_records.annotated_field(
                        assignment,
                        target.attr,
                        class_scope=False,
                    ),
                ]
        return []

    def __init__(
        self,
        node_index: PythonAstNodeIndexContract,
        instance_field_names: PythonInstanceFieldNamesContract,
        field_records: PythonClassFieldRecordContract,
    ) -> None:
        """Responsibilities: _instance field analysis dependencies_."""
        self._node_index: PythonAstNodeIndexContract = node_index
        self._instance_field_names: PythonInstanceFieldNamesContract = instance_field_names
        self._field_records: PythonClassFieldRecordContract = field_records

    def for_method(self, method: ast.stmt) -> list[JsonObject]:
        """Responsibilities: _method instance field collection_."""
        if type(method) is ast.FunctionDef or type(method) is ast.AsyncFunctionDef:
            statements = method.body
        else:
            return []
        fields: list[JsonObject] = []
        for node in self._method_body_nodes(statements):
            if type(node) is ast.Assign:
                fields.extend(self._assignment_fields(node))
            if type(node) is ast.AnnAssign:
                fields.extend(self._assignment_fields(node))
        return fields

    def for_class(self, methods: list[ast.stmt]) -> list[JsonObject]:
        """Responsibilities: _class instance field collection_."""
        fields: list[JsonObject] = []
        for method in methods:
            fields.extend(self.for_method(method))
        return fields
