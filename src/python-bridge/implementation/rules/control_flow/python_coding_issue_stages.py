from __future__ import annotations

import ast
from typing import cast

from implementation.ast.protocols import PythonSubtestAliasesContract
from implementation.references.decorator_protocols import (
    PythonPropertyDecoratorContract,
)
from implementation.references.protocols import PythonContainerKeysContract
from implementation.rules.constants import SPECIAL_NAMES
from implementation.types import JsonObject, PythonASTLocatedNode


class PythonCodingIssueStages:
    """Responsibilities: _shape property analysis_, _exception subtest analysis_."""

    def _assertion_statement(self, statement: ast.stmt) -> bool:
        """Responsibilities: _test assertion statement_."""
        if type(statement) is ast.Assert:
            return True
        if type(statement) is not ast.Expr or type(statement.value) is not ast.Call:
            return False
        function = statement.value.func
        if type(function) is not ast.Attribute:
            return False
        return function.attr.startswith("assert")

    def _setup_key(self, statement: ast.stmt) -> str:
        """Responsibilities: _runtime-equivalent assignment normalization_."""
        targets: list[ast.expr] = []
        value: ast.expr | None = None
        if type(statement) is ast.Assign:
            targets = statement.targets
            value = statement.value
        if type(statement) is ast.AnnAssign:
            targets = [statement.target]
            value = statement.value
        if not targets or value is None:
            return ast.dump(statement, include_attributes=False)
        target_keys = tuple(ast.dump(target, include_attributes=False) for target in targets)
        value_key = ast.dump(value, include_attributes=False)
        return repr((target_keys, value_key))

    def _duplicate_setup_pair(
        self,
        previous: ast.stmt,
        current: ast.stmt,
    ) -> list[JsonObject]:
        """Responsibilities: _duplicate setup pair_."""
        if self._setup_key(previous) != self._setup_key(current):
            return []
        return [{"line": current.lineno - 1, "kind": "test-duplicate-setup"}]

    def _duplicate_setup_body(self, statements: list[ast.stmt]) -> list[JsonObject]:
        """Responsibilities: _duplicate setup body_."""
        previous: ast.stmt | None = None
        for statement in statements:
            if self._assertion_statement(statement):
                previous = None
                continue
            if previous is not None:
                issue = self._duplicate_setup_pair(previous, statement)
                if issue:
                    return issue
            previous = statement
        return []

    def _shape_name(self, shape_expression: ast.AST) -> str:
        """Responsibilities: _special result shape name_."""
        if type(shape_expression) is ast.Name:
            return shape_expression.id
        if type(shape_expression) is ast.Attribute:
            return shape_expression.attr
        if type(shape_expression) is ast.Call:
            if type(shape_expression.func) is not ast.Attribute:
                return ""
            if shape_expression.func.attr != "get" or not shape_expression.args:
                return ""
            return self._container_keys.static_key(shape_expression.args[0])
        if type(shape_expression) is not ast.Subscript:
            return ""
        return self._container_keys.static_key(shape_expression.slice)

    def _implemented_body(self, body: list[ast.stmt]) -> bool:
        """Responsibilities: _property body implementation detection_."""
        for statement in body:
            if type(statement) is ast.Expr and type(statement.value) is ast.Constant:
                if statement.value.value is Ellipsis:
                    continue
            return True
        return False

    def __init__(
        self,
        container_keys: PythonContainerKeysContract,
        python_decorator_rules: PythonPropertyDecoratorContract,
        subtest_aliases: PythonSubtestAliasesContract,
    ) -> None:
        """Responsibilities: _simple issue stage initialization_."""
        self._container_keys: PythonContainerKeysContract = container_keys
        self._python_decorator_rules: PythonPropertyDecoratorContract = python_decorator_rules
        self._subtest_aliases: PythonSubtestAliasesContract = subtest_aliases

    def shape_issues(self, shape_expression: ast.AST) -> list[JsonObject]:
        """Responsibilities: _multiple-result-shape issue collection_."""
        name = self._shape_name(shape_expression)
        if name not in SPECIAL_NAMES:
            return []
        return [
            {
                "line": cast(PythonASTLocatedNode, shape_expression).lineno - 1,
                "kind": "multiple-result-shapes",
            },
        ]

    def property_issues(self, property_declaration: ast.AST) -> list[JsonObject]:
        """Responsibilities: _property issue collection_."""
        match property_declaration:
            case ast.FunctionDef(name=name, body=body, decorator_list=decorators):
                pass
            case ast.AsyncFunctionDef(name=name, body=body, decorator_list=decorators):
                pass
            case _:
                return []
        issues: list[JsonObject] = []
        if name.startswith("test_"):
            issues = self._duplicate_setup_body(body)
        if not self._implemented_body(body):
            return issues
        for decorator in decorators:
            if self._python_decorator_rules.property_decorator(decorator):
                issues.append({"line": decorator.lineno - 1, "kind": "python-property"})
        return issues

    def exception_issues(self, raise_statement: ast.AST) -> list[JsonObject]:
        """Responsibilities: _exception-raising issue collection_."""
        if type(raise_statement) is not ast.Raise:
            return []
        return [{"line": raise_statement.lineno - 1, "kind": "exception-raising"}]

    def subtest_issues(self, subtest_candidate: ast.AST) -> list[JsonObject]:
        """Responsibilities: _subtest issue collection_."""
        aliases = self._subtest_aliases.aliases_for(subtest_candidate)
        if not self._subtest_aliases.matches(subtest_candidate, aliases):
            return []
        return [
            {
                "line": cast(PythonASTLocatedNode, subtest_candidate).lineno - 1,
                "kind": "python-test-subtest",
            },
        ]
