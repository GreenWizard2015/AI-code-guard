from __future__ import annotations

import ast

from implementation.rules.constants import SPECIAL_NAMES
from implementation.rules.protocols import (
    PythonContainerKeysProtocol,
    PythonPropertyDecoratorProtocol,
    PythonSubtestAliasesProtocol,
)
from implementation.types import JsonObject


class PythonCodingIssueStages:
    """Responsibilities: _simple Python rule stages_."""

    def _shape_name(self, node: ast.AST) -> str:
        """Responsibilities: _special result shape name_."""
        if type(node) is ast.Name:
            return node.id
        if type(node) is ast.Attribute:
            return node.attr
        if type(node) is not ast.Subscript:
            return ""
        return self.container_keys.static_key(node.slice)

    def __init__(
        self,
        container_keys: PythonContainerKeysProtocol,
        decorator_rules: PythonPropertyDecoratorProtocol,
        subtest_aliases: PythonSubtestAliasesProtocol,
    ) -> None:
        """Responsibilities: _simple issue stage initialization_."""
        self.container_keys: PythonContainerKeysProtocol = container_keys
        self.decorator_rules: PythonPropertyDecoratorProtocol = decorator_rules
        self.subtest_aliases: PythonSubtestAliasesProtocol = subtest_aliases

    def shape_issues(self, node: ast.AST) -> list[JsonObject]:
        """Responsibilities: _multiple-result-shape issue collection_."""
        name = self._shape_name(node)
        if name not in SPECIAL_NAMES:
            return []
        return [{"line": node.lineno - 1, "kind": "multiple-result-shapes"}]

    def match_issues(self, node: ast.AST) -> list[JsonObject]:
        """Responsibilities: _switch issue collection_."""
        if type(node) is not ast.Match:
            return []
        return [{"line": node.lineno - 1, "kind": "switch"}]

    def property_issues(self, node: ast.AST) -> list[JsonObject]:
        """Responsibilities: _property issue collection_."""
        if type(node) not in (ast.FunctionDef, ast.AsyncFunctionDef):
            return []
        for decorator in node.decorator_list:
            if self.decorator_rules.property_decorator(decorator):
                return [{"line": decorator.lineno - 1, "kind": "python-property"}]
        return []

    def exception_issues(self, node: ast.AST) -> list[JsonObject]:
        """Responsibilities: _exception-raising issue collection_."""
        if type(node) is not ast.Raise:
            return []
        return [{"line": node.lineno - 1, "kind": "exception-raising"}]

    def subtest_issues(self, node: ast.AST) -> list[JsonObject]:
        """Responsibilities: _subtest issue collection_."""
        if not self.subtest_aliases.matches(node):
            return []
        return [{"line": node.lineno - 1, "kind": "python-test-subtest"}]
