from __future__ import annotations

import ast
from typing import Any

from implementation.references.protocols import (
    PythonProxyReceiverAliasesContract,
    PythonProxyTargetContract,
)
from implementation.types import JsonObject
from implementation.rules.constants import (
    PYTHON_KEYWORD_ONLY_ARGUMENTS_KEY,
    PYTHON_POSITIONAL_ARGUMENTS_KEY,
)


class PythonProxyCallableAnalyzer:
    """Responsibilities: _proxy callable detection_, _argument forwarding analysis_."""

    def _parameter_parts(self, node: ast.AST) -> JsonObject:
        """Responsibilities: _normalization proxy parameter groups_."""
        arguments = node.args
        positional_arguments: Any = [*arguments.posonlyargs, *arguments.args]
        if positional_arguments:
            if positional_arguments[0].arg in {"self", "cls"}:
                positional_arguments: Any = positional_arguments[1:]
        positional: Any = [argument.arg for argument in positional_arguments]
        keyword_only: Any = [argument.arg for argument in arguments.kwonlyargs]
        vararg: Any = ""
        if arguments.vararg:
            vararg = arguments.vararg.arg
        return {
            "positional": positional,
            "keyword_only": keyword_only,
            "vararg": vararg,
        }

    def _parameters(self, node: ast.AST) -> JsonObject:
        """Responsibilities: _normalization proxy callable parameters_."""
        arguments = node.args
        if arguments.kwarg:
            return {"valid": False, "parameters": [], "keyword_only": [], "vararg": ""}
        parts = self._parameter_parts(node)
        parameters: Any = [
            *parts[PYTHON_POSITIONAL_ARGUMENTS_KEY],
            *parts[PYTHON_KEYWORD_ONLY_ARGUMENTS_KEY],
        ]
        if parts["vararg"]:
            parameters.append(parts["vararg"])
        return {"valid": True, "parameters": parameters, **parts}

    def _argument_root(self, node: ast.AST) -> str:
        """Responsibilities: _resolution root argument name_."""
        if type(node) is ast.Name:
            return node.id
        if type(node) is ast.Attribute:
            return self._argument_root(node.value)
        if type(node) is ast.Starred:
            return self._argument_root(node.value)
        return ""

    def _forwarded_names(self, call: ast.Call) -> list[str]:
        """Responsibilities: _resolution forwarded argument names_."""
        argument_names: list[str] = []
        for argument in call.args:
            argument_name = self._argument_root(argument)
            if not argument_name:
                return []
            argument_names.append(argument_name)
        for keyword in call.keywords:
            if keyword.arg is None:
                return []
            argument_name = self._argument_root(keyword.value)
            if not argument_name:
                return []
            argument_names.append(argument_name)
        return argument_names

    def _vararg_forwarded(self, call: ast.Call, vararg: str) -> bool:
        """Responsibilities: _classification variadic forwarding_."""
        if not vararg:
            return True
        matches: list[ast.AST] = []
        for argument in call.args:
            if type(argument) is not ast.Starred:
                continue
            if self._argument_root(argument) == vararg:
                matches.append(argument)
        return len(matches) == 1

    def _forwards(self, call: ast.Call, contract: JsonObject) -> bool:
        """Responsibilities: _classification proxy argument forwarding_."""
        parameters: Any = contract["parameters"]
        keyword_only: Any = contract[PYTHON_KEYWORD_ONLY_ARGUMENTS_KEY]
        vararg: Any = contract["vararg"]
        if len(call.args) + len(call.keywords) != len(parameters):
            return False
        if any(self._argument_root(argument) in keyword_only for argument in call.args):
            return False
        if not self._vararg_forwarded(call, vararg):
            return False
        argument_names = self._forwarded_names(call)
        return sorted(argument_names) == sorted(parameters)

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
        if not body:
            return body
        first = body[0]
        if type(first) is not ast.Expr or type(first.value) is not ast.Constant:
            return body
        if type(first.value.value) is str:
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
        proxy_contract = self._parameters(node)
        if not calls:
            return False
        if not proxy_contract["valid"]:
            return False
        for call in calls:
            return self._forwards(call, proxy_contract)
        return False

    def _is_proxy_lambda(self, node: ast.AST) -> bool:
        """Responsibilities: _classification lambda forwards its_."""
        if not self.receiver_aliases.lambda_receiver(node):
            return False
        if type(node) is not ast.Lambda or type(node.body) is not ast.Call:
            return False
        if not self.target_policy.supported_target(node.body):
            return False
        parameters = self._parameters(node)
        if not parameters["valid"]:
            return False
        return self._forwards(node.body, parameters)

    def __init__(
        self,
        tree: ast.AST,
        target_policy: PythonProxyTargetContract,
        receiver_aliases: PythonProxyReceiverAliasesContract,
    ) -> None:
        """Responsibilities: _proxy parent relationships_."""
        self.tree: Any = tree
        self.receiver_aliases: PythonProxyReceiverAliasesContract = receiver_aliases
        self.target_policy: PythonProxyTargetContract = target_policy

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
