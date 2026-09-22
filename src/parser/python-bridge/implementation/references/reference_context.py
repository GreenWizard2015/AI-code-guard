from __future__ import annotations
from typing import Any


import ast

from implementation.references.constants import UNKNOWN_OWNER_TYPES


class PythonReferenceContext:
    """Responsibilities: _Python attribute result resolution_."""

    def _call_owner(self, value: ast.Call, current_owner: str) -> str:
        """Responsibilities: _resolution owner output invocation_."""
        if type(value.func) is ast.Name:
            return self.aliases.get(value.func.id, value.func.id)
        return self._method_return_owner(value.func, current_owner)

    def _nested_attribute_owner(self, value: ast.Attribute, current_owner: str) -> str:
        """Responsibilities: _resolution owners through nested_."""
        base_owner: Any = self.attribute_owner(value.value, current_owner)
        if not base_owner:
            return ""
        resolved_owner: Any = self.properties.get(f"{base_owner}.{value.attr}", "")
        if resolved_owner in UNKNOWN_OWNER_TYPES:
            return ""
        return resolved_owner

    def _method_return_owner(self, function: ast.AST, current_owner: str) -> str:
        """Responsibilities: _resolution owner type output_."""
        if type(function) is not ast.Attribute:
            return ""
        owner: Any = self.attribute_owner(function.value, current_owner)
        key: Any = function.attr
        if owner:
            key: Any = f"{owner}.{function.attr}"
        return self.call_returns.get(key, "")

    def __init__(
        self,
        aliases: dict[str, str],
        instances: dict[str, str],
        properties: dict[str, str],
        call_returns: dict[str, str],
    ) -> None:
        """Responsibilities: _initialization aliases instances properties_."""
        self.aliases: Any = aliases
        self.instances: Any = instances
        self.properties: Any = properties
        self.call_returns: Any = call_returns
        self.aliases: Any = aliases

    def attribute_owner(self, value: ast.AST, current_owner: str) -> str:
        """Responsibilities: _resolution owner represented attribute_."""
        if type(value) is ast.Name:
            if value.id in {"self", "cls"}:
                return current_owner
            instance_owner: Any = self.instances.get(value.id, "")
            if instance_owner in UNKNOWN_OWNER_TYPES:
                return ""
            return instance_owner
        if type(value) is ast.Attribute:
            return self._nested_attribute_owner(value, current_owner)
        if type(value) is ast.Call:
            return self._call_owner(value, current_owner)
        return ""

    def call_return_owner(
        self,
        function: ast.AST,
        fallback_to_name: bool = False,
    ) -> str:
        """Responsibilities: _resolution owner output callable_."""
        if type(function) is not ast.Name:
            return ""
        owner: Any = self.call_returns.get(function.id, "")
        if owner or not fallback_to_name:
            return owner
        return self.aliases.get(function.id, function.id)
