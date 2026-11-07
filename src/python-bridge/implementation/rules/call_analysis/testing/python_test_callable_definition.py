from __future__ import annotations

import ast

from implementation.ast.protocols import PythonAstNodeIndexContract


class PythonTestCallableDefinition:
    """Responsibilities: _definition-time expression discovery_, _callable local bindings_."""

    def _argument_annotations(self, arguments: ast.arguments) -> list[ast.expr]:
        """Responsibilities: _callable argument annotation collection_."""
        annotations = [
            argument.annotation
            for argument in [
                *arguments.posonlyargs,
                *arguments.args,
                *arguments.kwonlyargs,
            ]
            if argument.annotation is not None
        ]
        annotations.extend(
            argument.annotation
            for argument in (arguments.vararg, arguments.kwarg)
            if argument is not None and argument.annotation is not None
        )
        return annotations

    def _append_nested_callable(
        self,
        current: ast.AST,
        pending: list[ast.AST],
        callables: dict[str, ast.AST],
        node_index: PythonAstNodeIndexContract,
    ) -> None:
        """Responsibilities: _nested callable collection step_."""
        match current:
            case ast.FunctionDef(name=name) | ast.AsyncFunctionDef(name=name):
                callables.setdefault(name, current)
                return
            case ast.Lambda():
                return
        pending.extend(reversed(node_index.children(current)))

    def _argument_names(self, arguments: ast.arguments) -> set[str]:
        """Responsibilities: _callable parameter name collection_."""
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

    def _assigned_names(self, executed_nodes: list[ast.AST]) -> set[str]:
        """Responsibilities: _local assignment names_."""
        names: set[str] = set()
        for node in executed_nodes:
            match node:
                case ast.FunctionDef(name=name) | ast.AsyncFunctionDef(name=name):
                    names.add(name)
                    continue
                case ast.Name(id=name, ctx=ast.Store()):
                    names.add(name)
        return names

    def __init__(self, callable_node: ast.AST, node_index: PythonAstNodeIndexContract) -> None:
        """Responsibilities: _callable syntax ownership_."""
        self._callable_node: ast.AST = callable_node
        self._node_index: PythonAstNodeIndexContract = node_index

    def definition_values(self) -> list[ast.expr]:
        """Responsibilities: _callable definition-time expressions_."""
        match self._callable_node:
            case ast.FunctionDef() | ast.AsyncFunctionDef() as function:
                values = [*function.decorator_list, *function.args.defaults]
                values.extend(value for value in function.args.kw_defaults if value is not None)
                values.extend(self._argument_annotations(function.args))
                if function.returns is not None:
                    values.append(function.returns)
                return values
            case ast.Lambda(args=arguments):
                return [
                    *arguments.defaults,
                    *(value for value in arguments.kw_defaults if value is not None),
                ]
            case _:
                return []

    def nested_callables(self) -> dict[str, ast.AST]:
        """Responsibilities: _nested callable definition lookup_."""
        body = self.body()
        if not body:
            return {}
        pending: list[ast.AST] = []
        pending.extend(reversed(body))
        callables: dict[str, ast.AST] = {}
        while pending:
            current = pending.pop()
            self._append_nested_callable(current, pending, callables, self._node_index)
        return callables

    def defined_before(self, call_line: int) -> bool:
        """Responsibilities: _callable definition order classification_."""
        match self._callable_node:
            case ast.FunctionDef(lineno=line) | ast.AsyncFunctionDef(lineno=line):
                return line <= call_line
            case _:
                return False

    def body(self) -> list[ast.stmt]:
        """Responsibilities: _callable executable statements_."""
        match self._callable_node:
            case ast.FunctionDef(body=statements) | ast.AsyncFunctionDef(
                body=statements,
            ):
                return statements
            case _:
                return []

    def local_names(self, executed_nodes: list[ast.AST]) -> set[str]:
        """Responsibilities: _callable local binding names_."""
        match self._callable_node:
            case ast.FunctionDef(args=arguments) | ast.AsyncFunctionDef(args=arguments):
                pass
            case _:
                return set()
        names = self._argument_names(arguments)
        names.update(self._assigned_names(executed_nodes))
        return names
