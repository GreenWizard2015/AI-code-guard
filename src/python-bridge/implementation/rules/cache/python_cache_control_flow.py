from __future__ import annotations

import ast

from implementation.rules.protocols import (
    PythonCacheNodeExecutionContract,
    PythonCacheReadStateContract,
)


class PythonCacheControlFlow:
    """Responsibilities: _cache control-flow branches_, _path state merging_."""

    _executor: PythonCacheNodeExecutionContract

    def _if(
        self, node: ast.If, state: PythonCacheReadStateContract
    ) -> PythonCacheReadStateContract:
        """Responsibilities: _conditional branch merge_."""
        tested = self._executor.analyze_node(node.test, state)
        body = self._executor.analyze_nodes(node.body, state.merge([tested]))
        other = self._executor.analyze_nodes(node.orelse, state.merge([tested]))
        return state.merge([body, other])

    def _if_expression(
        self, node: ast.IfExp, state: PythonCacheReadStateContract
    ) -> PythonCacheReadStateContract:
        """Responsibilities: _conditional expression merge_."""
        tested = self._executor.analyze_node(node.test, state)
        body = self._executor.analyze_node(node.body, state.merge([tested]))
        other = self._executor.analyze_node(node.orelse, state.merge([tested]))
        return state.merge([body, other])

    def _boolean(
        self, node: ast.BoolOp, state: PythonCacheReadStateContract
    ) -> PythonCacheReadStateContract:
        """Responsibilities: _short-circuit state merge_."""
        current = self._executor.analyze_node(node.values[0], state)
        for value in node.values[1:]:
            evaluated = self._executor.analyze_node(value, state.merge([current]))
            current = state.merge([current, evaluated])
        return current

    def _try(
        self, node: ast.AST, state: PythonCacheReadStateContract
    ) -> PythonCacheReadStateContract:
        """Responsibilities: _exception path merge_."""
        normal = self._executor.analyze_nodes(node.body, state.merge([state]))
        paths = [self._executor.analyze_nodes(node.orelse, normal.merge([normal]))]
        for handler in node.handlers:
            paths.append(
                self._executor.analyze_nodes(handler.body, state.merge([state]))
            )
        return self._executor.analyze_nodes(node.finalbody, state.merge(paths))

    def _loop(
        self, node: ast.AST, state: PythonCacheReadStateContract
    ) -> PythonCacheReadStateContract:
        """Responsibilities: _loop path merge_."""
        if type(node) in (ast.For, ast.AsyncFor):
            tested = self._executor.analyze_node(node.iter, state)
        else:
            tested = self._executor.analyze_node(node.test, state)
        body = self._executor.analyze_nodes(node.body, state.merge([tested]))
        paths = state.merge([tested, body])
        return self._executor.analyze_nodes(node.orelse, state.merge([paths]))

    def _match(
        self, node: ast.Match, state: PythonCacheReadStateContract
    ) -> PythonCacheReadStateContract:
        """Responsibilities: _pattern case merge_."""
        tested = self._executor.analyze_node(node.subject, state)
        paths = [tested]
        for case in node.cases:
            case_state = state.merge([tested])
            if case.guard is not None:
                case_state = self._executor.analyze_node(case.guard, case_state)
            paths.append(self._executor.analyze_nodes(case.body, case_state))
        return state.merge(paths)

    def __init__(self, executor: PythonCacheNodeExecutionContract) -> None:
        """Responsibilities: _cache flow executor setup_."""
        self._executor: PythonCacheNodeExecutionContract = executor

    def matches_control_flow(self, node: ast.AST) -> bool:
        """Responsibilities: _control-flow node classification_."""
        return type(node) in (
            ast.If,
            ast.IfExp,
            ast.BoolOp,
            ast.Try,
            ast.TryStar,
            ast.For,
            ast.AsyncFor,
            ast.While,
            ast.Match,
        )

    def control_flow_result(
        self, node: ast.AST, state: PythonCacheReadStateContract
    ) -> PythonCacheReadStateContract:
        """Responsibilities: _control-flow result selection_."""
        if type(node) is ast.If:
            return self._if(node, state)
        if type(node) is ast.IfExp:
            return self._if_expression(node, state)
        if type(node) is ast.BoolOp:
            return self._boolean(node, state)
        if type(node) in (ast.Try, ast.TryStar):
            return self._try(node, state)
        if type(node) in (ast.For, ast.AsyncFor, ast.While):
            return self._loop(node, state)
        if type(node) is ast.Match:
            return self._match(node, state)
        return state
