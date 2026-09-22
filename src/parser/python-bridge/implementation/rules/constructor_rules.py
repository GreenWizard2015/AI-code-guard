from __future__ import annotations


from typing import Any
import ast
from implementation.types import JsonObject


class ConstructorRules:
    """Responsibilities: _classification constructor assignments validation_."""

    def _constructor_call_name(self, function: ast.AST) -> str:
        """Responsibilities: _resolution name constructor invocation_."""
        if type(function) is ast.Name:
            return function.id
        if type(function) is ast.Attribute:
            return function.attr
        return ""

    def _constructor_value_allowed(self, value: ast.AST) -> bool:
        """Responsibilities: _classification constructor assignment value_."""
        if type(value) in (ast.Name, ast.Constant, ast.Attribute):
            return True
        if type(value) in (ast.Dict, ast.List, ast.Set, ast.Tuple):
            return True
        if type(value) is not ast.Call:
            return False
        function: Any = value.func
        is_named_attribute = type(function) is ast.Attribute
        if is_named_attribute:
            is_named_attribute = type(function.value) is ast.Name
        if is_named_attribute:
            if function.value.id == "self":
                return False
        return bool(self._constructor_call_name(function))

    def _is_super_init(self, node: ast.stmt) -> bool:
        """Responsibilities: _identification direct super initializer_."""
        if type(node) is not ast.Expr or type(node.value) is not ast.Call:
            return False
        function: Any = node.value.func
        if type(function) is not ast.Attribute or function.attr != "__init__":
            return False
        return self._super_call(function.value)

    def _super_call(self, target: ast.AST) -> bool:
        """Responsibilities: _classification super invocation target_."""
        if type(target) is not ast.Call:
            return False
        if type(target.func) is not ast.Name:
            return False
        return target.func.id == "super"

    def _is_validation_call(self, value: ast.AST) -> bool:
        """Responsibilities: _identification validation invocation permitted_."""
        if type(value) is not ast.Call:
            return False
        return self._constructor_call_name(value.func).startswith(
            self.validation_prefixes
        )

    def _constructor_body(self, node: ast.AST) -> list[ast.stmt]:
        """Responsibilities: _retrieval body constructor function_."""
        body: list[ast.stmt] = []
        for item in node.body:
            if not self._is_docstring(item):
                body.append(item)
        return body

    def _is_docstring(self, node: ast.stmt) -> bool:
        """Responsibilities: _identification leading constructor docstring_."""
        if type(node) is not ast.Expr or type(node.value) is not ast.Constant:
            return False
        return type(node.value.value) is str

    def _expression_allowed(self, node: ast.Expr) -> bool:
        """Responsibilities: _classification allowed expression statements_."""
        if self._is_validation_call(node.value):
            return True
        return type(node.value) is ast.Constant

    def __init__(self) -> None:
        """Responsibilities: _validation constants initialization _."""
        self.validation_prefixes: Any = ("validate_", "check_", "positive_")

    def statement_allowed(self, node: ast.stmt) -> bool:
        """Responsibilities: _classification constructor statement satisfies_."""
        if type(node) in (ast.Pass, ast.Raise):
            return True
        if self._is_super_init(node):
            return True
        if type(node) in (ast.Assign, ast.AnnAssign):
            if node.value is None:
                return True
            return self._constructor_value_allowed(node.value)
        if type(node) is ast.Expr:
            return self._expression_allowed(node)
        if type(node) is ast.If:
            statements = [*node.body, *node.orelse]
            return all(self.statement_allowed(item) for item in statements)
        return False

    def collect_constructor_issues(self, node: ast.AST) -> list[JsonObject]:
        """Responsibilities: _collection constructor statements violate_."""
        if type(node) not in (ast.FunctionDef, ast.AsyncFunctionDef):
            return []
        if node.name not in {"__init__", "__post_init__"}:
            return []
        body = self._constructor_body(node)
        if all(self.statement_allowed(item) for item in body):
            return []
        return [{"line": node.lineno - 1, "kind": "complex-constructor"}]
