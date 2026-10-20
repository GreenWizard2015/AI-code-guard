from __future__ import annotations

import ast

from implementation.ast.protocols import PythonAstNodeIndexContract
from implementation.types import JsonObject


class PythonDuplicateErrorTranslation:
    """Responsibilities: _duplicate handler detection_, _translation issue reporting_."""

    def _message_value(self, expression: ast.AST, aliases: dict[str, str]) -> str:
        """Responsibilities: _literal exception message resolution_."""
        if type(expression) is ast.Constant and type(expression.value) is str:
            return expression.value
        if type(expression) is ast.Name:
            return aliases.get(expression.id, "")
        return ""

    def _assignment(self, node: ast.AST, aliases: dict[str, str]) -> None:
        """Responsibilities: _handler-local message alias indexing_."""
        if (
            type(node) is ast.Assign
            and len(node.targets) == 1
            and type(node.targets[0]) is ast.Name
        ):
            value = self._message_value(node.value, aliases)
            if value:
                aliases[node.targets[0].id] = value
            return
        if (
            type(node) is ast.AnnAssign
            and type(node.target) is ast.Name
            and node.value is not None
        ):
            value = self._message_value(node.value, aliases)
            if value:
                aliases[node.target.id] = value

    def _translation_key(self, node: ast.AST, aliases: dict[str, str]) -> str:
        """Responsibilities: _error translation key construction_."""
        if type(node) is not ast.Raise or type(node.exc) is not ast.Call:
            return ""
        function = node.exc.func
        name = ""
        if type(function) is ast.Name:
            name = function.id
        if type(function) is ast.Attribute:
            name = function.attr
        if not name.endswith("Error"):
            return ""
        cause = ""
        if node.cause is not None:
            cause = ast.dump(node.cause, include_attributes=False)
        return self._translation_payload(node.exc, aliases, cause)

    def _translation_payload(
        self, call: ast.Call, aliases: dict[str, str], cause: str
    ) -> str:
        """Responsibilities: _translation payload construction_."""
        arguments = self._translation_arguments(call, aliases)
        return repr(
            (
                ast.dump(call.func, include_attributes=False),
                arguments,
                [
                    ast.dump(keyword, include_attributes=False)
                    for keyword in call.keywords
                ],
                cause,
            )
        )

    def _translation_arguments(
        self, call: ast.Call, aliases: dict[str, str]
    ) -> list[str]:
        """Responsibilities: _exception argument identity_."""
        arguments: list[str] = []
        for index, argument in enumerate(call.args):
            message = ""
            if index == 0:
                message = self._message_value(argument, aliases)
            if message:
                arguments.append(f"literal:{message}")
            else:
                arguments.append(ast.dump(argument, include_attributes=False))
        return arguments

    def _handler_translations(self, handler: ast.ExceptHandler) -> list[str]:
        """Responsibilities: _handler translation collection_."""
        keys: list[str] = []
        aliases: dict[str, str] = {}
        for current in ast.walk(handler):
            if current is not handler:
                if type(current) in (
                    ast.ExceptHandler,
                    ast.FunctionDef,
                    ast.AsyncFunctionDef,
                    ast.Lambda,
                ):
                    continue
            self._assignment(current, aliases)
            key = self._translation_key(current, aliases)
            if key:
                keys.append(key)
        return keys

    def __init__(self, node_index: PythonAstNodeIndexContract) -> None:
        """Responsibilities: _duplicate translation rule initialization_."""
        self._rule_id: str = "duplicate-error-translation"
        self._node_index: PythonAstNodeIndexContract = node_index

    def exception_scopes(self, tree: ast.Module) -> list[ast.ExceptHandler]:
        """Responsibilities: _exception scope selection_."""
        return [
            node
            for node in self._node_index.nodes(tree)
            if type(node) is ast.ExceptHandler
        ]

    def issues(self, tree: ast.Module) -> list[JsonObject]:
        """Responsibilities: _duplicate handler translation reporting_."""
        issues: list[JsonObject] = []
        for handler in self.exception_scopes(tree):
            keys = self._handler_translations(handler)
            if len(keys) != len(set(keys)):
                issues.append(
                    {"line": handler.lineno - 1, "kind": self._rule_id, "name": ""}
                )
        return issues
