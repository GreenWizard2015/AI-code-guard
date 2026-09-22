from __future__ import annotations

import ast

from implementation.ast.protocols import PythonAstNodeIndexProtocol
from implementation.types import JsonObject


class PythonDefaultParameterIssues:
    """Responsibilities: _identification complex default parameter_."""

    def _empty_container(self, value: ast.AST) -> bool:
        """Responsibilities: _empty default containers identification_."""
        if type(value) is ast.List:
            return not value.elts
        if type(value) is ast.Dict:
            return not value.keys and not value.values
        return False

    def _signed_number(self, value: ast.AST) -> bool:
        """Responsibilities: _signed numeric defaults identification_."""
        is_signed_number = type(value) is ast.UnaryOp
        if not is_signed_number or type(value.op) not in (ast.UAdd, ast.USub):
            return False
        if type(value.operand) is not ast.Constant:
            return False
        return type(value.operand.value) in (int, float, complex)

    def _is_primitive_default(self, value: ast.AST) -> bool:
        """Responsibilities: _primitive default values classification_."""
        if self._empty_container(value) or self._signed_number(value):
            return True
        if type(value) is not ast.Constant:
            return False
        if value.value is None:
            return True
        return type(value.value) in (bool, int, float, complex, str, bytes)

    def __init__(self, tree: ast.AST, node_index: PythonAstNodeIndexProtocol) -> None:
        """Responsibilities: _default-parameter analysis state initialization_."""
        self.tree: ast.AST = tree
        self.node_index: PythonAstNodeIndexProtocol = node_index

    def complex_default_issues(self, node: ast.AST) -> list[JsonObject]:
        """Responsibilities: _complex default violations collection_."""
        if type(node) not in (ast.FunctionDef, ast.AsyncFunctionDef, ast.Lambda):
            return []
        arguments = node.args
        defaults = list(arguments.defaults) + [
            value for value in arguments.kw_defaults if value
        ]
        return [
            {"line": value.lineno - 1, "kind": "complex-default-parameter"}
            for value in defaults
            if not self._is_primitive_default(value)
        ]

    def issues(self) -> list[JsonObject]:
        """Responsibilities: _collection default-parameter violations AST_."""
        issues: list[JsonObject] = []
        for node in self.node_index.nodes(self.tree):
            issues.extend(self.complex_default_issues(node))
        return issues
