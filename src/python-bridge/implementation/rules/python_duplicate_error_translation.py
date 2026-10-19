from __future__ import annotations

import ast

from implementation.protocols import PythonAstNodeIndexContract
from implementation.types import JsonObject


class PythonDuplicateErrorTranslation:
    """Responsibilities: _duplicate handler detection_, _translation issue reporting_."""

    def _translation_key(self, node: ast.AST) -> str:
        """Responsibilities: _error translation key construction_."""
        if type(node) is not ast.Raise or type(node.exc) is not ast.Call:
            return ""
        function = node.exc.func
        name = ""
        if type(function) is ast.Name:
            name = function.id
        if type(function) is ast.Attribute:
            name = function.attr
        if not name.endswith("Error"):
            return ""
        return ast.dump(node, include_attributes=False)

    def _handler_has_duplicate(self, handler: ast.ExceptHandler) -> bool:
        """Responsibilities: _duplicate handler translation detection_."""
        keys: set[str] = set()
        for current in ast.walk(handler):
            if current is not handler:
                if type(current) in (
                    ast.ExceptHandler,
                    ast.FunctionDef,
                    ast.AsyncFunctionDef,
                    ast.Lambda,
                ):
                    continue
            key = self._translation_key(current)
            if not key:
                continue
            if key in keys:
                return True
            keys.add(key)
        return False

    def __init__(self, node_index: PythonAstNodeIndexContract) -> None:
        """Responsibilities: _duplicate translation rule initialization_."""
        self._rule_id: str = "duplicate-error-translation"
        self._node_index: PythonAstNodeIndexContract = node_index

    def exception_scopes(self, tree: ast.Module) -> list[ast.ExceptHandler]:
        """Responsibilities: _exception scope selection_."""
        return [
            node
            for node in self._node_index.nodes(tree)
            if type(node) is ast.ExceptHandler
        ]

    def issues(self, tree: ast.Module) -> list[JsonObject]:
        """Responsibilities: _duplicate handler translation reporting_."""
        issues: list[JsonObject] = []
        for handler in self.exception_scopes(tree):
            if self._handler_has_duplicate(handler):
                issues.append(
                    {"line": handler.lineno - 1, "kind": self._rule_id, "name": ""}
                )
        return issues
