from __future__ import annotations


from dataclasses import dataclass
from functools import cached_property
from typing import Any
from implementation.ast.callable_arguments import CallableArguments
from implementation.ast.callable_metrics import CallableMetrics
from implementation.ast.callable_statements import CallableStatements
from implementation.ast.callable_node_builder import PythonCallableNode
import ast

from implementation.ast.class_nodes.class_node_details import PythonClassNodeDetails
from implementation.ast.protocols import PythonAstNodeIndexProtocol
from implementation.ast.source_segments import SourceSegments
from implementation.references.aliases.protocols import PythonContainerAliasesProtocol
from implementation.types import JsonObject


@dataclass(frozen=True)
class PythonClassNodeOptions:
    """Responsibilities: _class node construction inputs_."""

    node: ast.ClassDef
    source: str
    node_index: PythonAstNodeIndexProtocol
    source_segments: SourceSegments
    container_aliases: PythonContainerAliasesProtocol


class PythonClassNode:
    """Responsibilities: _Python class nodes normalization_, _method metadata collection_."""

    result: JsonObject

    def _method_candidates(self) -> list[ast.stmt]:
        """Responsibilities: _class method candidates collection_."""
        candidates: list[ast.stmt] = []
        for item in self.node.body:
            if type(item) in (ast.FunctionDef, ast.AsyncFunctionDef):
                candidates.append(item)
        return candidates

    def __init__(self, options: PythonClassNodeOptions) -> None:
        """Responsibilities: _class source metadata initialization_."""
        self.node: Any = options.node
        self.source: Any = options.source
        self.node_index: Any = options.node_index
        self.source_segments: Any = options.source_segments
        self.callable_statements: Any = CallableStatements()
        self.details: Any = PythonClassNodeDetails(
            options.node,
            options.node_index,
            self.callable_statements,
            options.container_aliases,
        )

    @cached_property
    def result(self) -> JsonObject:
        """Responsibilities: _class metadata construction_."""
        metadata: Any = self.details.metadata(self.method_nodes)
        return {
            **metadata,
            "methods": self.method_nodes,
            "fields": self.details.field_details.fields(),
            "untyped_fields": self.details.field_details.untyped_fields(),
            "callback_fields": 0,
            "inline_callback_fields": 0,
            "dependencies": self.details.dependencies(),
        }

    @cached_property
    def method_nodes(self) -> list[dict]:
        """Responsibilities: _method node serialization_."""
        methods: Any = []
        callable_arguments: Any = CallableArguments(self.node_index)
        callable_metrics: Any = CallableMetrics()
        callable_statements: Any = CallableStatements()
        for item in self._method_candidates():
            builder: Any = PythonCallableNode(
                item,
                self.node_index,
                self.source_segments,
                self.node.name,
            )
            methods.append(
                builder.result(
                    callable_statements, callable_arguments, callable_metrics
                )
            )
        return methods
