from __future__ import annotations

import ast


class PythonReceiverExpression:
    """Responsibilities: _receiver variable identity_, _receiver constructor identity_."""

    _expression: ast.AST

    def __init__(self, expression: ast.AST) -> None:
        """Responsibilities: _receiver expression ownership_."""
        self._expression = expression

    def variable_name(self) -> str:
        """Responsibilities: _receiver variable name_."""
        match self._expression:
            case ast.Name(id=name):
                return name
            case _:
                return ""

    def constructor_name(self) -> str:
        """Responsibilities: _receiver constructor name_."""
        match self._expression:
            case ast.Call(func=ast.Name(id=name)):
                return name
            case _:
                return ""
