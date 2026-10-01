from __future__ import annotations


from typing import Any
import ast
from implementation.types import JsonObject


class PythonProxyForwarding:
    """Responsibilities: _proxy argument forwarding contracts_."""

    def _parameter_parts(self) -> JsonObject:
        """Responsibilities: _normalization proxy parameter groups_."""
        positional_arguments: Any = [*self.arguments.posonlyargs, *self.arguments.args]
        if positional_arguments:
            if positional_arguments[0].arg in {"self", "cls"}:
                positional_arguments: Any = positional_arguments[1:]
        positional: Any = [argument.arg for argument in positional_arguments]
        keyword_only: Any = [argument.arg for argument in self.arguments.kwonlyargs]
        vararg: Any = ""
        if self.arguments.vararg:
            vararg = self.arguments.vararg.arg
        return {
            "positional": positional,
            "keyword_only": keyword_only,
            "vararg": vararg,
        }

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
            argument_name: Any = self._argument_root(argument)
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

    def __init__(self, node: ast.AST) -> None:
        """Responsibilities: _initialization proxy parameter contract_."""
        self.arguments: ast.arguments = node.args

    def parameters(self) -> JsonObject:
        """Responsibilities: _normalization proxy callable parameters_."""
        if self.arguments.kwarg:
            return {"valid": False, "parameters": [], "keyword_only": [], "vararg": ""}
        parts = self._parameter_parts()
        parameters: Any = [*parts["positional"], *parts["keyword_only"]]
        if parts["vararg"]:
            parameters.append(parts["vararg"])
        return {"valid": True, "parameters": parameters, **parts}

    def forwards(self, call: ast.Call, contract: JsonObject) -> bool:
        """Responsibilities: _classification proxy argument forwarding_."""
        parameters: Any = contract["parameters"]
        keyword_only: Any = contract["keyword_only"]
        vararg: Any = contract["vararg"]
        if len(call.args) + len(call.keywords) != len(parameters):
            return False
        if any(self._argument_root(argument) in keyword_only for argument in call.args):
            return False
        if not self._vararg_forwarded(call, vararg):
            return False
        argument_names = self._forwarded_names(call)
        return sorted(argument_names) == sorted(parameters)
