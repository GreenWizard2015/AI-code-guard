from __future__ import annotations

import ast
from collections.abc import Mapping

from implementation.rules.call_analysis.python_callable_scope import PythonCallableScope

PythonTestExecutionNodes = list[ast.AST]


class PythonTestExecutionRegion:
    """Responsibilities: _test execution ownership_, _deferred callable boundaries_."""

    function: ast.AST
    _node_cache: dict[ast.AST, PythonTestExecutionNodes]

    def _function_definition_values(self, node: ast.AST) -> list[ast.AST]:
        """Responsibilities: _function definition expressions_."""
        if type(node) not in (ast.FunctionDef, ast.AsyncFunctionDef):
            return []
        arguments = node.args
        values = [*node.decorator_list, *arguments.defaults]
        values.extend(value for value in arguments.kw_defaults if value is not None)
        values.extend(self._argument_annotations(arguments))
        if node.returns is not None:
            values.append(node.returns)
        return values

    def _argument_annotations(self, arguments: ast.arguments) -> list[ast.AST]:
        """Responsibilities: _callable argument annotations_."""
        annotations: list[ast.AST] = []
        annotations.extend(
            argument.annotation
            for argument in [
                *arguments.posonlyargs,
                *arguments.args,
                *arguments.kwonlyargs,
            ]
            if argument.annotation is not None
        )
        for argument in (arguments.vararg, arguments.kwarg):
            if argument is not None and argument.annotation is not None:
                annotations.append(argument.annotation)
        return annotations

    def _lambda_definition_values(self, node: ast.Lambda) -> list[ast.AST]:
        """Responsibilities: _lambda definition-time expressions_."""
        arguments = node.args
        values = list(arguments.defaults)
        values.extend(value for value in arguments.kw_defaults if value is not None)
        return values

    def _nested_callables(self, function: ast.AST) -> dict[str, ast.AST]:
        """Responsibilities: _nested callable lookup_."""
        pending = list(reversed(function.body))
        callables: dict[str, ast.AST] = {}
        while pending:
            current = pending.pop()
            if type(current) in (ast.FunctionDef, ast.AsyncFunctionDef):
                callables.setdefault(current.name, current)
                continue
            if type(current) is ast.Lambda:
                continue
            pending.extend(reversed(list(ast.iter_child_nodes(current))))
        return callables

    def _append_executed_node(
        self,
        current: ast.AST,
        nodes: list[ast.AST],
        callables: Mapping[str, ast.AST],
        expanded: set[ast.AST],
    ) -> None:
        """Responsibilities: _execution region traversal_."""
        if type(current) in (ast.FunctionDef, ast.AsyncFunctionDef):
            nodes.append(current)
            for value in self._function_definition_values(current):
                self._append_executed_node(value, nodes, callables, expanded)
            return
        if type(current) is ast.Lambda:
            for value in self._lambda_definition_values(current):
                self._append_executed_node(value, nodes, callables, expanded)
            return
        nodes.append(current)
        for child in ast.iter_child_nodes(current):
            self._append_executed_node(child, nodes, callables, expanded)
        self._append_invoked_callable(current, nodes, callables, expanded)

    def _append_invoked_callable(
        self,
        current: ast.AST,
        nodes: list[ast.AST],
        callables: Mapping[str, ast.AST],
        expanded: set[ast.AST],
    ) -> None:
        """Responsibilities: _invoked callable expansion_."""
        if type(current) is not ast.Call or type(current.func) is not ast.Name:
            return
        invoked = callables.get(current.func.id)
        if invoked is None or invoked in expanded or invoked.lineno > current.lineno:
            return
        expanded.add(invoked)
        nested_callables = PythonCallableScope(
            callables, self._nested_callables(invoked)
        )
        for statement in invoked.body:
            self._append_executed_node(statement, nodes, nested_callables, expanded)

    def _collect_nodes(self) -> list[ast.AST]:
        """Responsibilities: _test execution node collection_."""
        function = self.function
        if type(function) not in (ast.FunctionDef, ast.AsyncFunctionDef):
            return []
        nodes: list[ast.AST] = []
        callables = self._nested_callables(function)
        expanded: set[ast.AST] = set()
        for statement in function.body:
            self._append_executed_node(statement, nodes, callables, expanded)
        return nodes

    def _argument_names(self, arguments: ast.arguments) -> set[str]:
        """Responsibilities: _test argument bindings_."""
        names = {
            argument.arg
            for argument in [
                *arguments.posonlyargs,
                *arguments.args,
                *arguments.kwonlyargs,
            ]
        }
        for argument in (arguments.vararg, arguments.kwarg):
            if argument is not None:
                names.add(argument.arg)
        return names

    def _execution_node_names(self, nodes: PythonTestExecutionNodes) -> set[str]:
        """Responsibilities: _test execution bindings_."""
        names: set[str] = set()
        for node in nodes:
            if type(node) in (ast.FunctionDef, ast.AsyncFunctionDef):
                names.add(node.name)
            if type(node) is ast.Name and type(node.ctx) is ast.Store:
                names.add(node.id)
        return names

    def __init__(self, function: ast.AST) -> None:
        """Responsibilities: _test execution scope ownership_."""
        self.function: ast.AST = function
        self._node_cache: dict[ast.AST, list[ast.AST]] = {}

    def nodes(self) -> list[ast.AST]:
        """Responsibilities: _test execution region_."""
        if self.function in self._node_cache:
            return self._node_cache[self.function]
        nodes = self._collect_nodes()
        self._node_cache[self.function] = nodes
        return nodes

    def local_names(self) -> set[str]:
        """Responsibilities: _test-local binding names_."""
        if type(self.function) not in (ast.FunctionDef, ast.AsyncFunctionDef):
            return set()
        names = self._argument_names(self.function.args)
        names.update(self._execution_node_names(self.nodes()))
        return names
