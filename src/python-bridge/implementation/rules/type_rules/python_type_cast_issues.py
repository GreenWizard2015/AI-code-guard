from __future__ import annotations

import ast

from implementation.rules.constants import (
    PYTHON_TYPE_CAST_KIND,
    PYTHON_TYPING_EXTENSIONS_MODULE,
    PYTHON_TYPING_MODULE,
)
from implementation.types import JsonObject


class PythonTypeCastIssues:
    """Responsibilities: _typing cast import tracking_, _cast reference resolution_, _Python type cast reporting_."""

    _typing_modules: set[str]
    _cast_names: set[str]

    def _configure_modules(self, node: ast.Import) -> None:
        """Responsibilities: _typing module aliases_."""
        for imported in node.names:
            if imported.name not in (PYTHON_TYPING_MODULE, PYTHON_TYPING_EXTENSIONS_MODULE):
                continue
            self._typing_modules.add(imported.asname or imported.name)

    def _configure_casts(self, node: ast.ImportFrom) -> None:
        """Responsibilities: _typing cast aliases_."""
        if node.module not in (PYTHON_TYPING_MODULE, PYTHON_TYPING_EXTENSIONS_MODULE):
            return
        for imported in node.names:
            if imported.name == "*":
                self._cast_names.add("cast")
            else:
                if imported.name == "cast":
                    self._cast_names.add(imported.asname or imported.name)

    def _cast_reference(self, expression: ast.AST) -> bool:
        """Responsibilities: _cast function identity_."""
        if type(expression) is ast.Name:
            return expression.id in self._cast_names
        if type(expression) is not ast.Attribute or expression.attr != "cast":
            return False
        if type(expression.value) is not ast.Name:
            return False
        return expression.value.id in self._typing_modules

    def __init__(self) -> None:
        """Responsibilities: _type cast alias state_."""
        self._typing_modules = set()
        self._cast_names = set()

    def configure(self, tree: ast.AST) -> None:
        """Responsibilities: _type cast import aliases_."""
        self._typing_modules.clear()
        self._cast_names.clear()
        if type(tree) is not ast.Module:
            return
        for node in ast.walk(tree):
            if type(node) is ast.Import:
                self._configure_modules(node)
            if type(node) is ast.ImportFrom:
                self._configure_casts(node)

    def issues(self, syntax_node: ast.AST) -> list[JsonObject]:
        """Responsibilities: _type cast issue classification_."""
        if type(syntax_node) is not ast.Call:
            return []
        if not self._cast_reference(syntax_node.func):
            return []
        return [{"line": syntax_node.lineno - 1, "kind": PYTHON_TYPE_CAST_KIND}]
