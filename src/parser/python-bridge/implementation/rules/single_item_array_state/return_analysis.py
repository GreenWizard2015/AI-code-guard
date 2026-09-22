from __future__ import annotations
from typing import Any

import ast


class PythonReturnArrayAnalyzer:
    """Responsibilities: _collection output expressions_, _single-item arrays identification_."""

    def _visit(self, node: ast.AST, expressions: list[ast.expr]) -> None:
        """Responsibilities: _output nodes AST traversal_."""
        if type(node) is ast.Return and node.value is not None:
            expressions.append(node.value)
            return
        if type(node) in self.nested_callable_types:
            return
        for child in ast.iter_child_nodes(node):
            self._visit(child, expressions)

    def __init__(self) -> None:
        """Responsibilities: _initialization result expression analysis_."""
        self.nested_callable_types: Any = {
            ast.FunctionDef,
            ast.AsyncFunctionDef,
            ast.Lambda,
        }

    def returned_expressions(self, node: ast.AST) -> list[ast.expr]:
        """Responsibilities: _collection expressions output node_."""
        expressions: list[ast.expr] = []
        for statement in node.body:
            self._visit(statement, expressions)
        return expressions

    def single_arrays(self, node: ast.AST) -> bool:
        """Responsibilities: _reporting output single-item arrays_."""
        expressions: Any = self.returned_expressions(node)
        has_expressions = bool(expressions)
        if not has_expressions:
            return False
        return all(
            type(expression) is ast.List and len(expression.elts) <= 1
            for expression in expressions
        )
