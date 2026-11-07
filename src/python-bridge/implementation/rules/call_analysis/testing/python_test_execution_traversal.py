from __future__ import annotations

import ast
from collections.abc import Mapping, Sequence

from implementation.ast.protocols import PythonAstNodeIndexContract
from implementation.rules.call_analysis.testing.python_test_callable_definition import (
    PythonTestCallableDefinition,
)


class PythonTestExecutionTraversal:
    """Responsibilities: _test AST traversal_, _local helper analysis_."""

    def _append_invoked_callable(self, current: ast.AST) -> None:
        """Responsibilities: _invoked local helper analysis_."""
        if type(current) is not ast.Call or type(current.func) is not ast.Name:
            return
        invoked = self._callables.get(current.func.id)
        if invoked is None or invoked in self._expanded:
            return
        definition = PythonTestCallableDefinition(invoked, self._node_index)
        if not definition.defined_before(current.lineno):
            return
        self._expanded.add(invoked)
        nested_callables = definition.nested_callables()
        nested_traversal = PythonTestExecutionTraversal(
            self._nodes,
            nested_callables,
            self._expanded,
            self._node_index,
        )
        nested_traversal.walk(definition.body())

    def __init__(
        self,
        nodes: list[ast.AST],
        callables: Mapping[str, ast.AST],
        expanded: set[ast.AST],
        node_index: PythonAstNodeIndexContract,
    ) -> None:
        """Responsibilities: _test traversal state ownership_."""
        self._nodes: list[ast.AST] = nodes
        self._callables: Mapping[str, ast.AST] = callables
        self._expanded: set[ast.AST] = expanded
        self._node_index: PythonAstNodeIndexContract = node_index

    def visit(self, current: ast.AST) -> None:
        """Responsibilities: _single AST node traversal_."""
        if type(current) is ast.FunctionDef or type(current) is ast.AsyncFunctionDef:
            self._nodes.append(current)
            definition = PythonTestCallableDefinition(current, self._node_index)
            self.walk(definition.definition_values())
            return
        if type(current) is ast.Lambda:
            self._nodes.append(current)
            definition = PythonTestCallableDefinition(current, self._node_index)
            self.walk(definition.definition_values())
            return
        self._nodes.append(current)
        for child in self._node_index.children(current):
            self.visit(child)
        self._append_invoked_callable(current)

    def walk(self, nodes: Sequence[ast.AST]) -> None:
        """Responsibilities: _AST node sequence traversal_."""
        for node in nodes:
            self.visit(node)
