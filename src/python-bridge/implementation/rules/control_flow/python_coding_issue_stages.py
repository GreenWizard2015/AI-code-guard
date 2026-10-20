from __future__ import annotations

import ast

from implementation.ast.protocols import PythonSubtestAliasesContract
from implementation.references.protocols import PythonContainerKeysContract
from implementation.references.protocols import PythonPropertyDecoratorContract
from implementation.rules.constants import SPECIAL_NAMES
from implementation.types import JsonObject


class PythonCodingIssueStages:
    """Responsibilities: _shape property analysis_, _exception subtest analysis_."""

    def _shape_name(self, node: ast.AST) -> str:
        """Responsibilities: _special result shape name_."""
        if type(node) is ast.Name:
            return node.id
        if type(node) is ast.Attribute:
            return node.attr
        if type(node) is ast.Call:
            if (
                type(node.func) is ast.Attribute
                and node.func.attr == "get"
                and node.args
            ):
                return self.container_keys.static_key(node.args[0])
            return ""
        if type(node) is not ast.Subscript:
            return ""
        return self.container_keys.static_key(node.slice)

    def __init__(
        self,
        container_keys: PythonContainerKeysContract,
        python_decorator_rules: PythonPropertyDecoratorContract,
        subtest_aliases: PythonSubtestAliasesContract,
    ) -> None:
        """Responsibilities: _simple issue stage initialization_."""
        self.container_keys: PythonContainerKeysContract = container_keys
        self.python_decorator_rules: PythonPropertyDecoratorContract = (
            python_decorator_rules
        )
        self.subtest_aliases: PythonSubtestAliasesContract = subtest_aliases

    def shape_issues(self, node: ast.AST) -> list[JsonObject]:
        """Responsibilities: _multiple-result-shape issue collection_."""
        name = self._shape_name(node)
        if name not in SPECIAL_NAMES:
            return []
        return [{"line": node.lineno - 1, "kind": "multiple-result-shapes"}]

    def property_issues(self, node: ast.AST) -> list[JsonObject]:
        """Responsibilities: _property issue collection_."""
        if type(node) not in (ast.FunctionDef, ast.AsyncFunctionDef):
            return []
        for decorator in node.decorator_list:
            if self.python_decorator_rules.property_decorator(decorator):
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
