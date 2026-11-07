from __future__ import annotations

import ast
from collections.abc import Mapping
from functools import cached_property

from implementation.ast.protocols import PythonAstNodeIndexContract
from implementation.rules.call_analysis.testing.protocols import (
    PythonTestExecutionRegionContract,
)
from implementation.rules.call_analysis.testing.python_test_callable_definition import (
    PythonTestCallableDefinition,
)
from implementation.rules.call_analysis.testing.python_test_execution_traversal import (
    PythonTestExecutionTraversal,
)


class PythonTestExecutionRegion(PythonTestExecutionRegionContract):
    """Responsibilities: _test execution region_, _test-local bindings_."""

    _function: ast.AST
    _callables: Mapping[str, ast.AST]

    def _collect_nodes(self) -> list[ast.AST]:
        """Responsibilities: _test execution node collection_."""
        match self._function:
            case ast.FunctionDef(body=statements) | ast.AsyncFunctionDef(
                body=statements,
            ):
                nodes: list[ast.AST] = []
                traversal = PythonTestExecutionTraversal(nodes, self._callables, set(), self._node_index)
                traversal.walk(statements)
                return nodes
            case _:
                return []

    def __init__(
        self,
        function: ast.AST,
        callables: Mapping[str, ast.AST],
        node_index: PythonAstNodeIndexContract,
    ) -> None:
        """Responsibilities: _test callable initialization_."""
        self._function: ast.AST = function
        self._callables: Mapping[str, ast.AST] = callables
        self._node_index: PythonAstNodeIndexContract = node_index

    @cached_property
    def nodes(self) -> list[ast.AST]:
        """Responsibilities: _cached test execution region_."""
        return self._collect_nodes()

    def local_names(self) -> set[str]:
        """Responsibilities: _test-local binding lookup_."""
        definition = PythonTestCallableDefinition(self._function, self._node_index)
        return definition.local_names(self.nodes)
