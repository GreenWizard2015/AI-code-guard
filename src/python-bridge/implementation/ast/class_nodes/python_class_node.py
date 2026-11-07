from __future__ import annotations

import ast
from functools import cached_property
from typing import cast

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
from implementation.ast.protocols import (
    PythonCallableStatementsContract,
    PythonClassNodeDetailsContract,
    PythonClassNodeFieldsContract,
    PythonClassNodeOptionsContract,
)
from implementation.types import JsonObject, JsonValueList


class PythonClassNode:
    """Responsibilities: _Python class node normalization_, _method metadata collection_."""

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
    def result(self) -> JsonObject:
        """Responsibilities: _class metadata construction_."""
        metadata = self._details.metadata(self.method_nodes)
        fields = self._field_details.fields()
        return {
            **metadata,
            "methods": cast(JsonValueList, self.method_nodes),
            "fields": cast(JsonValueList, fields),
            "untyped_fields": cast(
                JsonValueList,
                self._field_details.untyped_field_records().collect(fields),
            ),
            "callback_fields": 0,
            "inline_callback_fields": 0,
            "dependencies": cast(JsonValueList, self._details.dependencies()),
        }

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
