from __future__ import annotations

import ast

from implementation.types import JsonObject


class PythonPredicateCondition:
    """Responsibilities: _predicate condition analysis_."""

    def _predicate_name(self, node: ast.Call) -> bool:
        """Responsibilities: _predicate names_."""
        function = node.func
        if type(function) is ast.Name:
            name = function.id
        else:
            if type(function) is not ast.Attribute:
                return False
            name = function.attr
        if name in {"type", "len", "bool", "isinstance", "issubclass", "all", "any"}:
            return True
        if name.startswith(("is", "has", "can")):
            return True
        if not name.startswith("_"):
            return False
        return name.endswith(("_factory", "_target", "_type"))

    def _predicate_call(self, node: ast.AST) -> bool:
        """Responsibilities: _predicate invocation identification_."""
        if type(node) is not ast.Call:
            return True
        return self._predicate_name(node)

    def _contains_impure_call(self, node: ast.BoolOp) -> bool:
        """Responsibilities: _impure invocation detection_."""
        for item in ast.walk(node):
            if not self._predicate_call(item):
                return True
        return False

    def _is_scope_parent(self, parent: ast.AST) -> bool:
        """Responsibilities: _scope parent classification_."""
        return type(parent) in (
            ast.Module,
            ast.FunctionDef,
            ast.AsyncFunctionDef,
            ast.ClassDef,
        )

    def __init__(self) -> None:
        """Responsibilities: _predicate analysis setup_."""
        pass

    def condition(self, node: ast.BoolOp, parent: ast.AST) -> bool:
        """Responsibilities: _predicate condition_."""
        if type(parent) not in (ast.If, ast.While, ast.For, ast.AsyncFor):
            return False
        for item in ast.walk(node):
            if type(item) is not ast.Call:
                continue
            if not self._predicate_call(item):
                return False
        return True

    def violation(
        self,
        node: ast.BoolOp,
        parent: ast.AST,
        assignment_values: set[int],
    ) -> list[JsonObject]:
        """Responsibilities: _conditional execution classification_."""
        issue = [{"line": node.lineno - 1, "kind": "conditional-execution"}]
        if type(parent) is ast.Expr:
            return issue
        if type(parent) is ast.BoolOp:
            return []
        if not self._contains_impure_call(node):
            return []
        if self.condition(node, parent):
            return issue
        if id(node) in assignment_values:
            return issue
        if self._is_scope_parent(parent):
            return []
        return issue
