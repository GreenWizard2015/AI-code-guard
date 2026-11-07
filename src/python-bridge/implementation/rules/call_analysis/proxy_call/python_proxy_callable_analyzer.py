from __future__ import annotations

import ast

from implementation.protocols import PythonProxyCallableSyntaxContract
from implementation.types import JsonObject


class PythonProxyCallableAnalyzer:
    """Responsibilities: _proxy callable detection_, _argument forwarding analysis_."""

    def _is_proxy_callable(self, candidate: ast.AST) -> bool:
        """Responsibilities: _function proxy classification_."""
        if type(candidate) is ast.FunctionDef:
            function_name = candidate.name
        else:
            if type(candidate) is not ast.AsyncFunctionDef:
                return False
            function_name = candidate.name
        if function_name.startswith("_"):
            return False
        if self._syntax.property_decorated(candidate):
            return False
        return self._syntax.proxy_call(candidate)

    def __init__(self, syntax: PythonProxyCallableSyntaxContract) -> None:
        """Responsibilities: _proxy syntax analysis setup_."""
        self._syntax: PythonProxyCallableSyntaxContract = syntax

    def analyze(self, candidate: ast.AST) -> list[JsonObject]:
        """Responsibilities: _proxy callable diagnostics dispatch_."""
        if type(candidate) is ast.Lambda:
            return self.analyze_lambda(candidate)
        if type(candidate) is ast.FunctionDef or type(candidate) is ast.AsyncFunctionDef:
            return self.analyze_callable(candidate)
        return []

    def analyze_callable(self, callable_definition: ast.AST) -> list[JsonObject]:
        """Responsibilities: _proxy callable diagnostics_."""
        if not self._is_proxy_callable(callable_definition):
            return []
        if type(callable_definition) is ast.FunctionDef:
            line = callable_definition.lineno - 1
        else:
            if type(callable_definition) is not ast.AsyncFunctionDef:
                return []
            line = callable_definition.lineno - 1
        return [{"line": line, "kind": "proxy-callable"}]

    def analyze_lambda(self, lambda_expression: ast.AST) -> list[JsonObject]:
        """Responsibilities: _proxy lambda diagnostics_."""
        if not self._syntax.proxy_lambda(lambda_expression):
            return []
        if type(lambda_expression) is not ast.Lambda:
            return []
        return [{"line": lambda_expression.lineno - 1, "kind": "proxy-lambda"}]
