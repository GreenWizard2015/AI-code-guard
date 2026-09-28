from __future__ import annotations

import ast
from implementation.references.aliases.protocols import PythonContainerAliasesProtocol


class PythonContainerKeys:
    """Responsibilities: _static container key values_."""

    def _constant_key(self, value: ast.Constant) -> str:
        """Responsibilities: _constant container key resolution_."""
        if type(value.value) not in (str, int):
            return ""
        return str(value.value)

    def _binary_key(self, value: ast.BinOp) -> str:
        """Responsibilities: _binary container key resolution_."""
        if type(value.op) is not ast.Add:
            return ""
        left = self.static_key(value.left)
        right = self.static_key(value.right)
        if not left:
            return ""
        if not right:
            return ""
        return left + right

    def _joined_string_value(self, node: ast.JoinedStr) -> str:
        """Responsibilities: _joined string key resolution_."""
        for value in node.values:
            if type(value) is ast.FormattedValue:
                return ""
        return "".join(self.string_value(value) for value in node.values)

    def _binary_string_value(self, node: ast.BinOp) -> str:
        """Responsibilities: _concatenated string key resolution_."""
        if type(node.op) is not ast.Add:
            return ""
        left = self.string_value(node.left)
        right = self.string_value(node.right)
        if not left:
            return ""
        if not right:
            return ""
        return left + right

    def __init__(self, state: PythonContainerAliasesProtocol) -> None:
        """Responsibilities: _container key state binding_."""
        self.state: PythonContainerAliasesProtocol = state

    def static_key(self, value: ast.AST) -> str:
        """Responsibilities: _static container key resolution_."""
        if type(value) is ast.Constant:
            return self._constant_key(value)
        if type(value) is ast.BinOp:
            return self._binary_key(value)
        if type(value) is ast.Name:
            return self.state.static_alias(value.id)
        return ""

    def string_value(self, node: ast.AST) -> str:
        """Responsibilities: _static string key resolution_."""
        static_key = self.static_key(node)
        if static_key:
            return static_key
        if type(node) is ast.Constant:
            if type(node.value) is str:
                return node.value
        if type(node) is ast.JoinedStr:
            return self._joined_string_value(node)
        if type(node) is ast.BinOp:
            return self._binary_string_value(node)
        return ""
