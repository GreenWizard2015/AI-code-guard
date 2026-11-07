from __future__ import annotations

import ast

from implementation.ast.protocols import PythonAstNodeIndexContract
from implementation.types import JsonObject


class PythonDefaultParameterIssues:
    """Responsibilities: _default value classification_, _parameter issue reporting_."""

    def _signed_numeric_default(self, value: ast.UnaryOp) -> bool:
        """Responsibilities: _signed numeric default classification_."""
        if type(value.op) not in (ast.UAdd, ast.USub):
            return False
        if type(value.operand) is not ast.Constant:
            return False
        return type(value.operand.value) in (int, float, complex)

    def _constant_default(self, value: ast.Constant) -> bool:
        """Responsibilities: _constant default classification_."""
        if value.value is None:
            return True
        return type(value.value) in (bool, int, float, complex, str, bytes)

    def _is_primitive_default(self, value: ast.AST) -> bool:
        """Responsibilities: _primitive default values classification_."""
        if type(value) is ast.List:
            return not value.elts
        if type(value) is ast.Dict:
            return not value.keys and not value.values
        if type(value) is ast.UnaryOp:
            return self._signed_numeric_default(value)
        if type(value) is ast.Constant:
            return self._constant_default(value)
        return False

    def __init__(self, tree: ast.AST, node_index: PythonAstNodeIndexContract) -> None:
        """Responsibilities: _default-parameter analysis state initialization_."""
        self._tree: ast.AST = tree
        self._node_index: PythonAstNodeIndexContract = node_index

    def complex_default_issues(self, node: ast.AST) -> list[JsonObject]:
        """Responsibilities: _complex default violations collection_."""
        match node:
            case ast.FunctionDef(args=arguments):
                pass
            case ast.AsyncFunctionDef(args=arguments):
                pass
            case ast.Lambda(args=arguments):
                pass
            case _:
                return []
        defaults = list(arguments.defaults) + [value for value in arguments.kw_defaults if value]
        return [
            {"line": value.lineno - 1, "kind": "complex-default-parameter"}
            for value in defaults
            if not self._is_primitive_default(value)
        ]

    def issues(self) -> list[JsonObject]:
        """Responsibilities: _collection default-parameter violations AST_."""
        issues: list[JsonObject] = []
        for node in self._node_index.nodes(self._tree):
            issues.extend(self.complex_default_issues(node))
        return issues
