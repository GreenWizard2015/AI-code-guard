from __future__ import annotations


from typing import Any
import ast
from implementation.types import JsonObject


class PythonProxyCallableAnalyzer:
    """Responsibilities: _detection proxy methods lambdas_."""

    def _is_property(self, node: ast.AST) -> bool:
        """Responsibilities: _classification callable decorated property_."""
        for item in node.decorator_list:
            if type(item) is ast.Name:
                if item.id in {"property", "cached_property"}:
                    return True
            else:
                if type(item) is ast.Call:
                    if type(item.func) is ast.Name:
                        if item.func.id in {"property", "cached_property"}:
                            return True
        return False

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
            if self._supported_target(value):
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

    def _proxy_parameters(self, node: ast.AST) -> JsonObject:
        """Responsibilities: _normalization positional variadic proxy_."""
        arguments: Any = node.args
        if arguments.vararg:
            return {"valid": False, "parameters": []}
        if arguments.kwarg:
            return {"valid": False, "parameters": []}
        if arguments.kwonlyargs:
            return {"valid": False, "parameters": []}
        positional: Any = [*arguments.posonlyargs, *arguments.args]
        if positional and positional[0].arg in {"self", "cls"}:
            positional: Any = positional[1:]
        return {"valid": True, "parameters": [argument.arg for argument in positional]}

    def _forwards(self, call: ast.Call, parameters: list[str]) -> bool:
        """Responsibilities: _classification invocation forwards proxy_."""
        if len(call.args) != len(parameters):
            return False
        argument_names: list[str] = []
        for argument, parameter in zip(call.args, parameters):
            argument_name: Any = self._argument_root(argument)
            if not argument_name:
                return False
            argument_names.append(argument_name)
        return sorted(argument_names) == sorted(parameters)

    def _argument_root(self, node: ast.AST) -> str:
        """Responsibilities: _resolution root name invocation_."""
        if type(node) is ast.Name:
            return node.id
        if type(node) is ast.Attribute:
            return self._argument_root(node.value)
        return ""

    def _supported_target(self, call: ast.Call) -> bool:
        """Responsibilities: _classification invocation target supported_."""
        function: Any = call.func
        if type(function) is ast.Name:
            return True
        if type(function) is not ast.Attribute:
            return False
        owner: Any = function.value
        if type(owner) not in (ast.Name, ast.Attribute):
            return False
        if type(owner) is ast.Name:
            if owner.id.startswith("_"):
                return False
            if owner.id[:1].isupper():
                return False
        return True

    def _is_proxy_callable(self, node: ast.AST) -> bool:
        """Responsibilities: _classification function method forwards_."""
        name: Any = self.callable_name(node)
        if not name:
            return False
        if name.startswith("_"):
            return False
        if self._is_property(node):
            return False
        calls: Any = self._proxy_call(node.body)
        proxy_parameters: Any = self._proxy_parameters(node)
        if not calls:
            return False
        if not proxy_parameters["valid"]:
            return False
        return self._forwards(calls[0], proxy_parameters["parameters"])

    def _is_proxy_lambda(self, node: ast.AST) -> bool:
        """Responsibilities: _classification lambda forwards its_."""
        if type(node) is not ast.Lambda or type(node.body) is not ast.Call:
            return False
        function: Any = node.body.func
        if type(function) is not ast.Attribute:
            return False
        owner: Any = function.value
        if type(owner) is not ast.Name or owner.id not in {"self", "cls"}:
            return False
        if not self._supported_target(node.body):
            return False
        parameters: Any = self._proxy_parameters(node)
        if not parameters["valid"]:
            return False
        return self._forwards(node.body, parameters["parameters"])

    def __init__(self, tree: ast.AST) -> None:
        """Responsibilities: _proxy parent relationships_."""
        self.tree: Any = tree

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
