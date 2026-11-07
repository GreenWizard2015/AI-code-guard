from __future__ import annotations

import ast


class PythonNameAccess:
    """Responsibilities: _name access modes_, _expression context matching_."""

    def _matches(self, expression: ast.AST, context: type[ast.expr_context]) -> bool:
        """Responsibilities: _expression context matching_."""
        if type(expression) is ast.Name:
            return expression.id == self._name and type(expression.ctx) is context
        if type(expression) in (ast.FunctionDef, ast.AsyncFunctionDef, ast.Lambda):
            return False
        return any(self._matches(child, context) for child in ast.iter_child_nodes(expression))

    def __init__(self, expression: ast.AST, name: str) -> None:
        """Responsibilities: _expression access state_."""
        self._expression: ast.AST = expression
        self._name: str = name

    def reads(self) -> bool:
        """Responsibilities: _name access state_."""
        return self._matches(self._expression, ast.Load)

    def writes(self) -> bool:
        """Responsibilities: _name access state_."""
        return self._matches(self._expression, ast.Store)
