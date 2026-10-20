from __future__ import annotations

import ast

from implementation.ast.protocols import PythonAstNodeIndexContract
from implementation.types import JsonObject


class PythonRetryWithoutOwnership:
    """Responsibilities: _attempt policy_, _loop limits_."""

    def _contains_call(self, node: ast.AST) -> bool:
        """Responsibilities: _invocation presence_."""
        found = False

        def visit(current: ast.AST) -> None:
            """Responsibilities: _invocation traversal_."""
            nonlocal found
            if found:
                return
            if current is not node:
                if type(current) in (ast.FunctionDef, ast.AsyncFunctionDef, ast.Lambda):
                    return
            if type(current) is ast.Call:
                found = True
                return
            for child in ast.iter_child_nodes(current):
                visit(child)

        visit(node)
        return found

    def _contains_continue(self, node: ast.AST) -> bool:
        """Responsibilities: _continuation presence_."""
        found = False

        def visit(current: ast.AST) -> None:
            """Responsibilities: _continuation traversal_."""
            nonlocal found
            if found:
                return
            if current is not node:
                if type(current) in (
                    ast.FunctionDef,
                    ast.AsyncFunctionDef,
                    ast.Lambda,
                    ast.While,
                    ast.For,
                    ast.AsyncFor,
                ):
                    return
                if type(current) is ast.Continue:
                    found = True
                    return
            for child in ast.iter_child_nodes(current):
                visit(child)

        visit(node)
        return found

    def _retry_try_node(self, node: ast.AST) -> bool:
        """Responsibilities: _attempt try state_."""
        if type(node) is not ast.Try:
            return False
        has_call = any(self._contains_call(statement) for statement in node.body)
        if not has_call:
            return False
        return any(self._contains_continue(handler) for handler in node.handlers)

    def _nested_retry_boundary(self, current: ast.AST, node: ast.AST) -> bool:
        """Responsibilities: _attempt boundary state_."""
        if current is node:
            return False
        return type(current) in (
            ast.FunctionDef,
            ast.AsyncFunctionDef,
            ast.Lambda,
            ast.While,
            ast.For,
            ast.AsyncFor,
        )

    def _has_unbounded_retry(self, node: ast.While) -> bool:
        """Responsibilities: _attempt owner state_."""
        found = False

        def visit(current: ast.AST) -> None:
            """Responsibilities: _loop body state_."""
            nonlocal found
            if found:
                return
            if self._nested_retry_boundary(current, node):
                return
            if self._retry_try_node(current):
                found = True
                return
            for child in ast.iter_child_nodes(current):
                visit(child)

        for statement in node.body:
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
            if type(node) is ast.While
            and type(node.test) is ast.Constant
            and bool(node.test.value)
        ]

    def issues(self, tree: ast.Module) -> list[JsonObject]:
        """Responsibilities: _attempt owner violations_."""
        issues: list[JsonObject] = []
        for node in self.retry_loops(tree):
            if self._has_unbounded_retry(node):
                issues.append(
                    {
                        "line": node.lineno - 1,
                        "kind": self._rule_id,
                        "name": "",
                    }
                )
        return issues
