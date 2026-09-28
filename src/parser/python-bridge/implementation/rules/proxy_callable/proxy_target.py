from __future__ import annotations


from typing import Any
import ast


class PythonProxyTarget:
    """Responsibilities: _proxy target policy classification_."""

    def __init__(self) -> None:
        """Responsibilities: _initialization proxy target policy_."""
        self.property_decorators: set[str] = {"property", "cached_property"}

    def property_decorated(self, node: ast.AST) -> bool:
        """Responsibilities: _classification callable decorated property_."""
        for item in node.decorator_list:
            if type(item) is ast.Name:
                if item.id in self.property_decorators:
                    return True
            else:
                if type(item) is ast.Call and type(item.func) is ast.Name:
                    if item.func.id in self.property_decorators:
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
