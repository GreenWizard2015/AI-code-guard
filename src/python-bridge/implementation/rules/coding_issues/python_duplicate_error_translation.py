from __future__ import annotations

import ast

from implementation.ast.protocols import PythonAstNodeIndexContract
from implementation.rules.coding_issues.python_exception_handler_translations import (
    PythonExceptionHandlerTranslations,
)
from implementation.types import JsonObject


class PythonDuplicateErrorTranslation:
    """Responsibilities: _duplicate handler detection_, _translation issue reporting_."""

    def __init__(self, node_index: PythonAstNodeIndexContract) -> None:
        """Responsibilities: _duplicate translation rule initialization_."""
        self._rule_id: str = "duplicate-error-translation"
        self._node_index: PythonAstNodeIndexContract = node_index

    def exception_scopes(self, tree: ast.Module) -> list[ast.ExceptHandler]:
        """Responsibilities: _exception scope selection_."""
        return [node for node in self._node_index.nodes(tree) if type(node) is ast.ExceptHandler]

    def issues(self, tree: ast.Module) -> list[JsonObject]:
        """Responsibilities: _duplicate handler translation reporting_."""
        issues: list[JsonObject] = []
        for handler in self.exception_scopes(tree):
            translation_scope = PythonExceptionHandlerTranslations()
            keys = translation_scope.translations(handler)
            if len(keys) != len(set(keys)):
                issues.append(
                    {"line": handler.lineno - 1, "kind": self._rule_id, "name": ""},
                )
        return issues
