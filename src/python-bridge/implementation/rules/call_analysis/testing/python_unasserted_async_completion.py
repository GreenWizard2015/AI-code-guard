from __future__ import annotations

import ast

from implementation.ast.protocols import (
    PythonAstNodeIndexContract,
    PythonAsyncNameOverlayContract,
)
from implementation.rules.call_analysis.testing.protocols import (
    PythonAsyncModuleNameStateContract,
)
from implementation.rules.call_analysis.testing.python_async_module_name_state import (
    PythonAsyncModuleNameState,
)
from implementation.rules.call_analysis.testing.python_async_name_overlay import (
    PythonAsyncNameOverlay,
)
from implementation.rules.call_analysis.testing.python_test_callable_definition import (
    PythonTestCallableDefinition,
)
from implementation.rules.call_analysis.testing.python_test_execution_region import (
    PythonTestExecutionRegion,
)
from implementation.types import JsonObject


class PythonUnassertedAsyncCompletion:
    """Responsibilities: _async test discovery_, _unasserted completion reporting_."""

    def _append_issue(
        self,
        node: ast.AST,
        async_names: PythonAsyncNameOverlayContract,
        issues: list[JsonObject],
    ) -> None:
        """Responsibilities: _unasserted async call reporting_."""
        if type(node) is not ast.Expr:
            return
        name = async_names.async_call_name(node)
        if name:
            issues.append(
                {"line": node.lineno - 1, "kind": self._rule_id, "name": name},
            )

    def _function_issues(
        self,
        function: ast.AST,
        async_names: set[str],
    ) -> list[JsonObject]:
        """Responsibilities: _async issue collection_."""
        definition = PythonTestCallableDefinition(function, self._node_index)
        callables = definition.nested_callables()
        region = PythonTestExecutionRegion(function, callables, self._node_index)
        local_names = region.local_names()
        visible_async_names = PythonAsyncNameOverlay(async_names, local_names)
        issues: list[JsonObject] = []
        for node in region.nodes:
            visible_async_names.update_test_aliases(node)
            self._append_issue(node, visible_async_names, issues)
        return issues

    def __init__(self, node_index: PythonAstNodeIndexContract) -> None:
        """Responsibilities: _async completion rule initialization_."""
        self._rule_id: str = "unasserted-async-completion"
        self._node_index: PythonAstNodeIndexContract = node_index
        self._module_names: PythonAsyncModuleNameStateContract = PythonAsyncModuleNameState()

    def test_functions(self, tree: ast.Module) -> list[ast.AST]:
        """Responsibilities: _test function selection_."""
        functions: list[ast.AST] = []
        for node in self._node_index.nodes(tree):
            match node:
                case ast.FunctionDef(name=name) | ast.AsyncFunctionDef(name=name):
                    if name.startswith("test_"):
                        functions.append(node)
        return functions

    def issues(self, tree: ast.Module) -> list[JsonObject]:
        """Responsibilities: _async completion diagnostics_."""
        self._module_names.prepare(tree)
        async_names = self._module_names.snapshot()
        issues: list[JsonObject] = []
        for function in self.test_functions(tree):
            issues.extend(self._function_issues(function, async_names))
        return issues
