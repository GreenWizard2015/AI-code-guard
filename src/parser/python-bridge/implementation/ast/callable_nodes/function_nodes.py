from __future__ import annotations


from typing import Any
from implementation.ast.callable_node_builder import PythonCallableNode
from implementation.ast.callable_nodes.function_selector import PythonFunctionSelector
from implementation.ast.callable_arguments import CallableArguments
from implementation.ast.callable_metrics import CallableMetrics
from implementation.ast.callable_statements import CallableStatements
from implementation.ast.protocols import (
    PythonAstNodeIndexProtocol,
    PythonCallableArgumentsProtocol,
    PythonCallableMetricsProtocol,
    PythonCallableStatementsProtocol,
    PythonSourceSegmentsProtocol,
)
from implementation.types import JsonObject
import ast


class PythonFunctionNodes:
    """Responsibilities: _normalization Python function nodes_."""

    def _node(self, node: ast.AST) -> JsonObject:
        """Responsibilities: _normalization Python function node_."""
        builder: Any = PythonCallableNode(
            node, self.node_index, self.source_segments
        )
        builder.nested = self.function_selector.nested(node)
        return builder.result(
            self.callable_statements,
            self.callable_arguments,
            self.callable_metrics,
        )

    def __init__(
        self,
        tree: ast.Module,
        node_index: PythonAstNodeIndexProtocol,
        source_segments: PythonSourceSegmentsProtocol,
    ) -> None:
        """Responsibilities: _initialization Python function collection_."""
        self.tree: ast.Module = tree
        self.node_index: PythonAstNodeIndexProtocol = node_index
        self.source_segments: PythonSourceSegmentsProtocol = source_segments
        self.function_selector: PythonFunctionSelector = PythonFunctionSelector(
            tree, node_index
        )
        self.callable_arguments: PythonCallableArgumentsProtocol = CallableArguments(node_index)
        self.callable_metrics: PythonCallableMetricsProtocol = CallableMetrics()
        self.callable_statements: PythonCallableStatementsProtocol = CallableStatements()

    def function(self, node: ast.AST) -> bool:
        """Responsibilities: _classification Python function node_."""
        return type(node) in (ast.FunctionDef, ast.AsyncFunctionDef)

    def nodes(self) -> list[JsonObject]:
        """Responsibilities: _collection Python function nodes_."""
        results: list[JsonObject] = []
        for node in self.function_selector.nodes():
            if not self.function(node):
                continue
            result = self._node(node)
            if result:
                results.append(result)
        return results

    def callable_count(self) -> JsonObject:
        """Responsibilities: _count Python callable nodes_."""
        nodes: list[ast.AST] = []
        for node in self.node_index.nodes(self.tree):
            if self.function(node):
                nodes.append(node)
                continue
            if type(node) is ast.Lambda:
                nodes.append(node)
        if not nodes:
            return {"count": 0, "first_line": 0}
        return {"count": len(nodes), "first_line": min(node.lineno for node in nodes) - 1}
