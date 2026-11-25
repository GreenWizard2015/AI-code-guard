from __future__ import annotations

import ast
from collections.abc import Sequence

from implementation.ast.callable_nodes.python_function_node_context import (
    PythonFunctionNodeContext,
)
from implementation.ast.callable_nodes.python_function_node_record import (
    PythonFunctionNodeRecord,
)
from implementation.ast.callable_nodes.protocols import PythonFunctionNodesOptionsContract
from implementation.ast.callables.callable_arguments import CallableArguments
from implementation.ast.callables.callable_metrics import CallableMetrics
from implementation.ast.callables.callable_statements import CallableStatements
from implementation.ast.protocols import (
    PythonAstNodeIndexContract,
    PythonFunctionNode,
    PythonFunctionSelectorContract,
    PythonSourceSegmentsContract,
    PythonTestAssertionDataContract,
)
from implementation.references.protocols import (
    PythonContainerAliasesContract,
    PythonScopedTypeAliasesContract,
)
from implementation.types import JsonObject


class PythonFunctionNodes:
    """Responsibilities: _function node collection_, _callable metadata normalization_."""

    def _records(self, nodes: Sequence[PythonFunctionNode]) -> list[JsonObject]:
        """Responsibilities: _Python function record normalization_."""
        results: list[JsonObject] = []
        for node in nodes:
            record = PythonFunctionNodeRecord(node, self._context)
            result = record.callable_metadata()
            result.update(record.body_data())
            if result:
                results.append(result)
        return results

    def __init__(self, options: PythonFunctionNodesOptionsContract) -> None:
        """Responsibilities: _initialization Python function collection_."""
        self._tree: ast.Module = options.tree
        self._node_index: PythonAstNodeIndexContract = options.node_index
        self._function_selector: PythonFunctionSelectorContract = options.function_selector
        self._context: PythonFunctionNodeContext = PythonFunctionNodeContext(
            options.source_segments,
            options.function_selector,
            options.test_assertion_data,
            CallableArguments(self._node_index, options.type_aliases),
            CallableMetrics(self._node_index),
            CallableStatements(),
        )

    def nodes(self) -> list[JsonObject]:
        """Responsibilities: _collection Python function nodes_."""
        return self._records(self._function_selector.nodes())

    def source_functions(self) -> list[JsonObject]:
        """Responsibilities: _source function records_."""
        return self._records(self._function_selector.source_nodes())

    def callable_count(self) -> JsonObject:
        """Responsibilities: _count Python callable nodes_."""
        nodes: list[PythonFunctionNode | ast.Lambda] = []
        for node in self._node_index.nodes(self._tree):
            match node:
                case ast.FunctionDef() | ast.AsyncFunctionDef() | ast.Lambda():
                    nodes.append(node)
        if not nodes:
            return {"count": 0, "first_line": 0}
        return {
            "count": len(nodes),
            "first_line": min(node.lineno for node in nodes) - 1,
        }
