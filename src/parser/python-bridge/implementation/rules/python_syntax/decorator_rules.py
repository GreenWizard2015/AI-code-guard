from __future__ import annotations

import ast

from implementation.rules.python_syntax.decorator_alias_state import (
    PythonDecoratorAliasState,
)


class PythonDecoratorRules:
    """Responsibilities: _Python decorator classification_."""

    def _named_kind(self, decorator: ast.AST) -> str:
        """Responsibilities: _named decorator classification_."""
        if type(decorator) is not ast.Name:
            return ""
        if decorator.id in self.aliases.static_method_names:
            return "python-static-method"
        if decorator.id in self.aliases.class_method_names:
            return "python-class-method"
        if decorator.id in self.aliases.property_setter_names:
            return "python-property-setter"
        return ""

    def _qualified_kind(self, decorator: ast.AST) -> str:
        """Responsibilities: _qualified decorator classification_."""
        if type(decorator) is not ast.Attribute:
            return ""
        if decorator.attr == "staticmethod":
            return "python-static-method"
        if decorator.attr == "classmethod":
            return "python-class-method"
        if decorator.attr == "setter":
            return "python-property-setter"
        return ""

    def _decorator_kind(self, decorator: ast.AST) -> str:
        """Responsibilities: _decorator kind classification_."""
        kind = self._named_kind(decorator)
        if kind:
            return kind
        kind = self._qualified_kind(decorator)
        if kind:
            return kind
        return self._subscript_kind(decorator)

    def _subscript_kind(self, decorator: ast.AST) -> str:
        """Responsibilities: _subscript decorator classification_."""
        if type(decorator) is not ast.Subscript:
            return ""
        resolved = self.aliases.container_values.container_value(decorator)
        if not resolved.found():
            return ""
        expression = resolved.expression_node()
        kind = self._named_kind(expression)
        if kind:
            return kind
        return self._qualified_kind(expression)

    def __init__(self) -> None:
        """Responsibilities: _decorator rule initialization_."""
        self.aliases: PythonDecoratorAliasState = PythonDecoratorAliasState()

    def property_decorator(self, decorator: ast.AST) -> bool:
        """Responsibilities: _property decorator identification_."""
        if type(decorator) is ast.Name:
            return decorator.id in self.aliases.property_names
        if type(decorator) is ast.Attribute:
            return decorator.attr == "property"
        if type(decorator) is ast.Subscript:
            resolved = self.aliases.container_values.container_value(decorator)
            if not resolved.found():
                return False
            return self.property_decorator(resolved.expression_node())
        return False

    def kinds(self, node: ast.AST) -> list[str]:
        """Responsibilities: _decorator kind collection_."""
        if type(node) not in (ast.FunctionDef, ast.AsyncFunctionDef):
            return []
        kinds: list[str] = []
        for decorator in node.decorator_list:
            kind = self._decorator_kind(decorator)
            if kind:
                kinds.append(kind)
        return kinds
