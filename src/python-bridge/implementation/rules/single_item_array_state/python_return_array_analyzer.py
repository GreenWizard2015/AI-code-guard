from __future__ import annotations

import ast

from implementation.rules.protocols import PythonReturnArrayAnalyzerContract


class PythonReturnArrayAnalyzer(PythonReturnArrayAnalyzerContract):
    """Responsibilities: _collection output expressions_, _single-item arrays identification_."""

    def _visit(self, statement: ast.AST, expressions: list[ast.expr]) -> None:
        """Responsibilities: _output nodes AST traversal_."""
        match statement:
            case ast.Return(value=expression) if expression is not None:
                expressions.append(expression)
                return
            case ast.FunctionDef() | ast.AsyncFunctionDef() | ast.Lambda():
                return
            case _:
                for child in ast.iter_child_nodes(statement):
                    self._visit(child, expressions)

    def returned_expressions(self, callable_node: ast.AST) -> list[ast.expr]:
        """Responsibilities: _collection expressions output node_."""
        match callable_node:
            case ast.FunctionDef(body=body) | ast.AsyncFunctionDef(body=body):
                pass
            case _:
                return []
        expressions: list[ast.expr] = []
        for statement in body:
            self._visit(statement, expressions)
        return expressions

    def single_arrays(self, callable_node: ast.AST) -> bool:
        """Responsibilities: _reporting output single-item arrays_."""
        match callable_node:
            case ast.FunctionDef() | ast.AsyncFunctionDef():
                expressions = self.returned_expressions(callable_node)
            case _:
                return False
        has_expressions = bool(expressions)
        if not has_expressions:
            return False
        return all(type(expression) is ast.List and len(expression.elts) <= 1 for expression in expressions)
