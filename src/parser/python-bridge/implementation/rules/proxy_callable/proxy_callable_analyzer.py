from __future__ import annotations


from typing import Any
import ast
from implementation.types import JsonObject
from implementation.references.proxy_receiver_aliases import PythonProxyReceiverAliases
from implementation.rules.proxy_callable.proxy_forwarding import PythonProxyForwarding
from implementation.rules.proxy_callable.proxy_target import PythonProxyTarget


class PythonProxyCallableAnalyzer:
    """Responsibilities: _detection proxy methods lambdas_."""

    def _proxy_call(self, body: list[ast.stmt]) -> list[ast.Call]:
        """Responsibilities: _discovery direct invocation expressions_."""
        statements: Any = self._body_without_docstring(body)
        if len(statements) != 1:
            return []
        statement: Any = statements[0]
        if type(statement) not in (ast.Expr, ast.Return):
            return []
        value: Any = statement.value
        if type(value) is ast.Await:
            value: Any = value.value
        if type(value) is ast.Call:
            if self.target_policy.supported_target(value):
                return [value]
        return []

    def _body_without_docstring(self, body: list[ast.stmt]) -> list[ast.stmt]:
        """Responsibilities: _removal leading docstring callable_."""
        if body:
            if type(body[0]) is ast.Expr:
                if type(body[0].value) is ast.Constant:
                    if type(body[0].value.value) is str:
                        return body[1:]
        return body

    def _is_proxy_callable(self, node: ast.AST) -> bool:
        """Responsibilities: _classification function method forwards_."""
        name: Any = self.callable_name(node)
        if not name:
            return False
        if name.startswith("_"):
            return False
        if self.target_policy.property_decorated(node):
            return False
        return self._valid_proxy_forward(node)

    def _valid_proxy_forward(self, node: ast.AST) -> bool:
        """Responsibilities: _proxy forwarding classification_."""
        calls: Any = self._proxy_call(node.body)
        forwarding = PythonProxyForwarding(node)
        proxy_contract: Any = forwarding.parameters()
        if not calls:
            return False
        if not proxy_contract["valid"]:
            return False
        for call in calls:
            return forwarding.forwards(call, proxy_contract)
        return False

    def _is_proxy_lambda(self, node: ast.AST) -> bool:
        """Responsibilities: _classification lambda forwards its_."""
        if not self.receiver_aliases.lambda_receiver(node):
            return False
        if type(node) is not ast.Lambda or type(node.body) is not ast.Call:
            return False
        if not self.target_policy.supported_target(node.body):
            return False
        forwarding = PythonProxyForwarding(node)
        parameters: Any = forwarding.parameters()
        if not parameters["valid"]:
            return False
        return forwarding.forwards(node.body, parameters)

    def __init__(self, tree: ast.AST) -> None:
        """Responsibilities: _proxy parent relationships_."""
        self.tree: Any = tree
        self.receiver_aliases: PythonProxyReceiverAliases = PythonProxyReceiverAliases(tree)
        self.target_policy: PythonProxyTarget = PythonProxyTarget()

    def callable_name(self, node: ast.AST) -> str:
        """Responsibilities: _output normalization name callable_."""
        if type(node) not in (ast.FunctionDef, ast.AsyncFunctionDef):
            return ""
        return node.name

    def analyze(self, node: ast.AST) -> list[JsonObject]:
        """Responsibilities: _emit proxy-callable proxy-lambda diagnostics_."""
        if self._is_proxy_lambda(node):
            return [{"line": node.lineno - 1, "kind": "proxy-lambda"}]
        if not self._is_proxy_callable(node):
            return []
        return [{"line": node.lineno - 1, "kind": "proxy-callable"}]
