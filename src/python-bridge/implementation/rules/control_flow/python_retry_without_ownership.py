from __future__ import annotations

import ast

from implementation.ast.protocols import PythonAstNodeIndexContract
from implementation.types import JsonObject


class PythonRetryWithoutOwnership:
    """Responsibilities: _attempt policy_, _loop limits_."""

    def _contains_call(self, subtree: ast.AST) -> bool:
        """Responsibilities: _invocation presence_."""
        found = False

        def visit(call_candidate: ast.AST) -> None:
            """Responsibilities: _invocation traversal_."""
            nonlocal found
            if found:
                return
            if call_candidate is not subtree:
                if type(call_candidate) in (
                    ast.FunctionDef,
                    ast.AsyncFunctionDef,
                    ast.Lambda,
                ):
                    return
            if type(call_candidate) is ast.Call:
                found = True
                return
            for child in ast.iter_child_nodes(call_candidate):
                visit(child)

        visit(subtree)
        return found

    def _contains_continue(self, subtree: ast.AST) -> bool:
        """Responsibilities: _continuation presence_."""
        found = False

        def visit(continuation_candidate: ast.AST) -> None:
            """Responsibilities: _continuation traversal_."""
            nonlocal found
            if found:
                return
            if continuation_candidate is not subtree:
                if type(continuation_candidate) in (
                    ast.FunctionDef,
                    ast.AsyncFunctionDef,
                    ast.Lambda,
                    ast.While,
                    ast.For,
                    ast.AsyncFor,
                ):
                    return
                if type(continuation_candidate) is ast.Continue:
                    found = True
                    return
            for child in ast.iter_child_nodes(continuation_candidate):
                visit(child)

        visit(subtree)
        return found

    def _retry_try_node(self, candidate: ast.AST) -> bool:
        """Responsibilities: _attempt try state_."""
        if type(candidate) is not ast.Try:
            return False
        has_call = any(self._contains_call(statement) for statement in candidate.body)
        if not has_call:
            return False
        return any(self._contains_continue(handler) for handler in candidate.handlers)

    def _nested_retry_boundary(self, descendant: ast.AST, retry_loop: ast.AST) -> bool:
        """Responsibilities: _attempt boundary state_."""
        if descendant is retry_loop:
            return False
        return type(descendant) in (
            ast.FunctionDef,
            ast.AsyncFunctionDef,
            ast.Lambda,
            ast.While,
            ast.For,
            ast.AsyncFor,
        )

    def _has_unbounded_retry(self, retry_loop: ast.While) -> bool:
        """Responsibilities: _attempt owner state_."""
        found = False

        def visit(loop_descendant: ast.AST) -> None:
            """Responsibilities: _loop body state_."""
            nonlocal found
            if found:
                return
            if self._nested_retry_boundary(loop_descendant, retry_loop):
                return
            if self._retry_try_node(loop_descendant):
                found = True
                return
            for child in ast.iter_child_nodes(loop_descendant):
                visit(child)

        for statement in retry_loop.body:
            visit(statement)
        return found

    def __init__(self, node_index: PythonAstNodeIndexContract) -> None:
        """Responsibilities: _attempt initialization_."""
        self._rule_id: str = "retry-without-ownership"
        self._node_index: PythonAstNodeIndexContract = node_index

    def retry_loops(self, tree: ast.Module) -> list[ast.While]:
        """Responsibilities: _attempt loop ownership_."""
        return [
            node
            for node in self._node_index.nodes(tree)
            if type(node) is ast.While and type(node.test) is ast.Constant and bool(node.test.value)
        ]

    def issues(self, tree: ast.Module) -> list[JsonObject]:
        """Responsibilities: _attempt owner violations_."""
        return [
            {"line": node.lineno - 1, "kind": self._rule_id, "name": ""}
            for node in self.retry_loops(tree)
            if self._has_unbounded_retry(node)
        ]
