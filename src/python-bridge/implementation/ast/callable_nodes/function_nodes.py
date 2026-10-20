from __future__ import annotations

import ast
from dataclasses import dataclass
from typing import Any

from implementation.ast.callables.callable_arguments import CallableArguments
from implementation.ast.callables.callable_metrics import CallableMetrics
from implementation.ast.callables.callable_statements import CallableStatements
from implementation.ast.protocols import (
    PythonAstNodeIndexContract,
    PythonSourceSegmentsContract,
)
from implementation.ast.protocols import (
    PythonCallableArgumentsContract,
    PythonCallableMetricsContract,
    PythonCallableStatementsContract,
    PythonFunctionSelectorContract,
    PythonTestAssertionDataContract,
)
from implementation.references.protocols import (
    PythonContainerAliasesContract,
    PythonScopedTypeAliasesContract,
)
from implementation.types import JsonObject
from implementation.rules.constants import PYTHON_RETURN_TYPE_KEY, PYTHON_STATEMENTS_KEY


@dataclass(frozen=True)
class PythonFunctionNodesOptions:
    """Responsibilities: _Python syntax tree input_, _callable collection dependencies_."""

    tree: ast.Module
    node_index: PythonAstNodeIndexContract
    source_segments: PythonSourceSegmentsContract
    container_aliases: PythonContainerAliasesContract
    function_selector: PythonFunctionSelectorContract
    test_assertion_data: PythonTestAssertionDataContract
    type_aliases: PythonScopedTypeAliasesContract


class PythonFunctionNodes:
    """Responsibilities: _function node collection_, _callable metadata normalization_."""

    def _body_lines(
        self, node: ast.AST, callable_statements: PythonCallableStatementsContract
    ) -> int:
        """Responsibilities: _calculation callable body line_."""
        body: Any = callable_statements.body_without_docstring(node.body)
        if not body:
            return 0
        first: Any = body[0]
        last: Any = body[-1]
        last_line: Any = last.end_lineno
        if last_line is None:
            last_line = last.lineno
        return (last_line - first.lineno) + 1

    def _characters(
        self, node: ast.AST, callable_statements: PythonCallableStatementsContract
    ) -> int:
        """Responsibilities: _calculation significant callable characters_."""
        body: Any = callable_statements.body_without_docstring(node.body)
        source = ""
        if body:
            source = self.source_segments.segment(body[0])
        return max(1, self.source_segments.significant_characters(source))

    def _callable_metadata(self, node: ast.AST, nested: bool) -> JsonObject:
        """Responsibilities: _callable identity metrics arguments_."""
        arguments: Any = self.callable_arguments.callable_arguments(node)
        body: Any = self.callable_statements.body_without_docstring(node.body)
        data: dict[str, Any] = {
            "name": node.name,
            "start": node.lineno - 1,
            "end": (node.end_lineno or node.lineno) - 1,
            "lines": self._body_lines(node, self.callable_statements),
            "sloc": 1 + self.callable_metrics.statements_sloc(body),
            "control_flow_depth": self.callable_metrics.control_flow_depth(body),
            PYTHON_RETURN_TYPE_KEY: "",
            "exception_only": len(body) == 1 and type(body[0]) is ast.Raise,
        }
        data.update(
            self.callable_arguments.argument_metadata(
                node, arguments, self._characters(node, self.callable_statements)
            )
        )
        data["nested"] = nested
        return data

    def _node(self, node: ast.AST) -> JsonObject:
        """Responsibilities: _normalization Python function node_."""
        nested = self.function_selector.nested(node)
        data: Any = self._callable_metadata(node, nested)
        if node.returns is not None:
            data[PYTHON_RETURN_TYPE_KEY] = ast.unparse(node.returns)
        statements: list[JsonObject] = []
        for item in self.callable_statements.body_without_docstring(node.body):
            statements.append(self.callable_statements.statement_node(item))
        data[PYTHON_STATEMENTS_KEY] = statements
        data.update(self.test_assertion_data.collect(node, self.callable_statements))
        return data

    def __init__(self, options: PythonFunctionNodesOptions) -> None:
        """Responsibilities: _initialization Python function collection_."""
        self.tree: ast.Module = options.tree
        self.node_index: PythonAstNodeIndexContract = options.node_index
        self.source_segments: PythonSourceSegmentsContract = options.source_segments
        self.container_aliases: PythonContainerAliasesContract = (
            options.container_aliases
        )
        self.function_selector: PythonFunctionSelectorContract = (
            options.function_selector
        )
        self.test_assertion_data: PythonTestAssertionDataContract = (
            options.test_assertion_data
        )
        self.callable_arguments: PythonCallableArgumentsContract = CallableArguments(
            self.node_index, options.type_aliases
        )
        self.callable_metrics: PythonCallableMetricsContract = CallableMetrics()
        self.callable_statements: PythonCallableStatementsContract = (
            CallableStatements()
        )

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
        return {
            "count": len(nodes),
            "first_line": min(node.lineno for node in nodes) - 1,
        }
