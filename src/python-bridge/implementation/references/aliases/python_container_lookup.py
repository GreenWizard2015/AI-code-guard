from __future__ import annotations

import ast

from implementation.references.aliases.protocols import PythonContainerLookupContract


class PythonContainerLookup(PythonContainerLookupContract):
    """Responsibilities: _lookup result state_, _fallback expression selection_."""

    def __init__(self, found_value: bool, expression: ast.AST) -> None:
        """Responsibilities: _lookup result initialization_."""
        self._found_value: bool = found_value
        self._expression: ast.AST = expression

    def found(self) -> bool:
        """Responsibilities: _lookup state reporting_."""
        return self._found_value

    def expression_node(self) -> ast.AST:
        """Responsibilities: _lookup expression reporting_."""
        return self._expression

    def __bool__(self) -> bool:
        """Responsibilities: _lookup truth conversion_."""
        return self._found_value

    def expression_or(self, fallback: ast.AST) -> ast.AST:
        """Responsibilities: _lookup fallback expression_."""
        if self._found_value:
            return self._expression
        return fallback
