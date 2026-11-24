from __future__ import annotations

import ast

from implementation.ast.protocols import PythonSubtestAliasesContract
from implementation.references.decorator_protocols import (
    PythonPropertyDecoratorContract,
)
from implementation.references.protocols import PythonContainerKeysContract
from implementation.rules.constants import (
    PYTHON_EXCEPTION_RAISING_RULE,
    PYTHON_MULTIPLE_RESULT_SHAPES_RULE,
    PYTHON_PROPERTY_RULE,
    PYTHON_TEST_SUBTEST_RULE,
    SPECIAL_NAMES,
)
from implementation.rules.control_flow.python_test_issue_stages import PythonTestIssueStages
from implementation.rules.control_flow.python_type_check_issue_stage import PythonTypeCheckIssueStage
from implementation.types import JsonObject


class PythonCodingIssueStages:
    """Responsibilities: _shape and property analysis_, _test subtest analysis_, _exception analysis_."""

    def _shape_name(self, shape_expression: ast.expr) -> str:
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

    def _function_property_issues(
        self,
        name: str,
        body: list[ast.stmt],
        decorators: list[ast.expr],
    ) -> list[JsonObject]:
        """Responsibilities: _callable property rules_, _test body diagnostics_."""
        issues: list[JsonObject] = []
        if name.startswith("test_"):
            issues = self._test_stages.test_body_issues(body)
        issues.extend(self._type_check_stages.type_check_issues(body))
        if not self._implemented_body(body):
            return issues
        for decorator in decorators:
            if self._python_decorator_rules.property_decorator(decorator):
                issues.append({"line": decorator.lineno - 1, "kind": PYTHON_PROPERTY_RULE})
        return issues

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
        self._test_stages: PythonTestIssueStages = PythonTestIssueStages()
        self._type_check_stages: PythonTypeCheckIssueStage = PythonTypeCheckIssueStage()

    def shape_issues(self, shape_expression: ast.AST) -> list[JsonObject]:
        """Responsibilities: _multiple-result-shape issue collection_."""
        match shape_expression:
            case ast.expr(lineno=line) as expression:
                if self._shape_name(expression) in SPECIAL_NAMES:
                    return [{"line": line - 1, "kind": PYTHON_MULTIPLE_RESULT_SHAPES_RULE}]
            case _:
                return []
        return []

    def property_issues(self, property_declaration: ast.AST) -> list[JsonObject]:
        """Responsibilities: _property issue collection_."""
        match property_declaration:
            case ast.FunctionDef(name=name, body=body, decorator_list=decorators):
                return self._function_property_issues(name, body, decorators)
            case ast.AsyncFunctionDef(name=name, body=body, decorator_list=decorators):
                return self._function_property_issues(name, body, decorators)
            case _:
                return []

    def exception_issues(self, raise_statement: ast.AST) -> list[JsonObject]:
        """Responsibilities: _exception-raising issue collection_."""
        if type(raise_statement) is not ast.Raise:
            return []
        return [{"line": raise_statement.lineno - 1, "kind": PYTHON_EXCEPTION_RAISING_RULE}]

    def subtest_issues(self, subtest_candidate: ast.AST) -> list[JsonObject]:
        """Responsibilities: _subtest issue collection_."""
        match subtest_candidate:
            case ast.With(lineno=line) | ast.AsyncWith(lineno=line) as subtest:
                pass
            case _:
                return []
        aliases = self._subtest_aliases.aliases_for(subtest)
        if not self._subtest_aliases.matches(subtest, aliases):
            return []
        return [
            {
                "line": line - 1,
                "kind": PYTHON_TEST_SUBTEST_RULE,
            },
        ]
