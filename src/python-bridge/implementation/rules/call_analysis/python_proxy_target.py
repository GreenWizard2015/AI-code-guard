from __future__ import annotations

import ast
from typing import Any
from implementation.rules.constants import (
    PYTHON_CACHED_PROPERTY_DECORATOR,
    PYTHON_PROPERTY_DECORATOR,
)


class PythonProxyTarget:
    """Responsibilities: _property target recognition_, _proxy target validation_."""

    def __init__(self) -> None:
        """Responsibilities: _initialization proxy target policy_."""
        self.property_decorators: set[str] = {
            PYTHON_PROPERTY_DECORATOR,
            PYTHON_CACHED_PROPERTY_DECORATOR,
        }

    def property_decorator(self, item: ast.AST) -> bool:
        """Responsibilities: _property decorator recognition_."""
        if type(item) is ast.Name:
            return item.id in self.property_decorators
        if type(item) is not ast.Call or type(item.func) is not ast.Name:
            return False
        return item.func.id in self.property_decorators

    def property_decorated(self, node: ast.AST) -> bool:
        """Responsibilities: _classification callable decorated property_."""
        for item in node.decorator_list:
            if self.property_decorator(item):
                return True
        return False

    def supported_target(self, call: ast.Call) -> bool:
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
