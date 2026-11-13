from __future__ import annotations

import ast
from functools import cached_property

from implementation.ast.callables.callable_statements import CallableStatements
from implementation.ast.class_nodes.python_class_method_node import (
    PythonClassMethodNode,
)
from implementation.ast.class_nodes.python_class_node_details import (
    PythonClassNodeDetails,
)
from implementation.ast.class_nodes.python_class_node_fields import (
    PythonClassNodeFields,
)
from implementation.ast.constants import (
    AST_CALLBACK_FIELDS_KEY,
    AST_DEPENDENCIES_KEY,
    AST_FIELDS_KEY,
    AST_INLINE_CALLBACK_FIELDS_KEY,
    AST_METHODS_KEY,
    AST_UNTYPED_FIELDS_KEY,
)
from implementation.ast.protocols import (
    PythonCallableStatementsContract,
    PythonClassNodeDetailsContract,
    PythonClassNodeFieldsContract,
    PythonClassNodeOptionsContract,
)
from implementation.types import JsonObject, JsonValueList


class PythonClassNode:
    """Responsibilities: _Python class node normalization_, _method metadata collection_."""

    def _method_metadata(self) -> JsonValueList:
        """Responsibilities: _class method metadata_."""
        methods: JsonValueList = []
        methods.extend(self.method_nodes)
        return methods

    def _field_metadata(self, fields: list[JsonObject]) -> JsonValueList:
        """Responsibilities: _class field metadata_."""
        field_values: JsonValueList = []
        field_values.extend(fields)
        return field_values

    def _untyped_field_metadata(self, fields: list[JsonObject]) -> JsonValueList:
        """Responsibilities: _untyped field metadata_."""
        untyped_fields: JsonValueList = []
        untyped_fields.extend(self._field_details.untyped_field_records().collect(fields))
        return untyped_fields

    def _dependency_metadata(self) -> JsonValueList:
        """Responsibilities: _class dependency metadata_."""
        dependencies: JsonValueList = []
        dependencies.extend(self._details.dependencies())
        return dependencies

    def __init__(self, options: PythonClassNodeOptionsContract) -> None:
        """Responsibilities: _class AST normalization state_."""
        self._node: ast.ClassDef = options.node
        self._options: PythonClassNodeOptionsContract = options
        self._callable_statements: PythonCallableStatementsContract = CallableStatements()
        self._field_details: PythonClassNodeFieldsContract = PythonClassNodeFields(
            options,
        )
        self._details: PythonClassNodeDetailsContract = PythonClassNodeDetails(
            options.node,
            options.node_index,
            self._callable_statements,
        )

    @cached_property
    def method_nodes(self) -> list[JsonObject]:
        """Responsibilities: _method node serialization_."""
        methods: list[JsonObject] = []
        for item in self._node.body:
            if type(item) is ast.FunctionDef:
                method_node = PythonClassMethodNode(item, self._options)
                methods.append(method_node.result())
            if type(item) is ast.AsyncFunctionDef:
                method_node = PythonClassMethodNode(item, self._options)
                methods.append(method_node.result())
        return methods

    @cached_property
    def result(self) -> JsonObject:
        """Responsibilities: _class metadata assembly_."""
        metadata = self._details.metadata(self.method_nodes)
        fields = self._field_details.fields()
        metadata[AST_METHODS_KEY] = self._method_metadata()
        metadata[AST_FIELDS_KEY] = self._field_metadata(fields)
        metadata[AST_UNTYPED_FIELDS_KEY] = self._untyped_field_metadata(fields)
        metadata[AST_CALLBACK_FIELDS_KEY] = 0
        metadata[AST_INLINE_CALLBACK_FIELDS_KEY] = 0
        metadata[AST_DEPENDENCIES_KEY] = self._dependency_metadata()
        return metadata
