from __future__ import annotations

import ast

from implementation.references.constants import UNKNOWN_OWNER_TYPES
from implementation.references.protocols import PythonReferenceContextContract


class PythonOwnerResolution:
    """Responsibilities: _lexical owner resolution_, _method return owner resolution_."""

    _ownership: PythonReferenceContextContract
    _current_owner: str

    def _call_owner(self, call_expression: ast.Call) -> str:
        """Responsibilities: _call result owner lookup_."""
        if type(call_expression.func) is ast.Name:
            return self._ownership.name_resolver().call_return_owner(
                call_expression.func,
                call_expression,
                fallback_to_name=True,
            )
        return self.method_return_owner(call_expression.func)

    def _nested_attribute_owner(self, attribute: ast.Attribute) -> str:
        """Responsibilities: _nested property owner lookup_."""
        base_owner = self.attribute_owner(attribute.value)
        if not base_owner:
            return ""
        return self._ownership.properties().owner(base_owner, attribute.attr, attribute)

    def _name_attribute_owner(self, name_expression: ast.Name) -> str:
        """Responsibilities: _named instance owner lookup_."""
        instance_owner = self._ownership.bindings().instance_owner(
            name_expression.id,
            name_expression,
        )
        if instance_owner in UNKNOWN_OWNER_TYPES:
            return ""
        if instance_owner:
            return instance_owner
        if self._ownership.bindings().instance_binding_present(
            name_expression.id,
            name_expression,
        ):
            return ""
        if name_expression.id in {"self", "cls"}:
            return self._current_owner
        return instance_owner

    def __init__(
        self,
        ownership: PythonReferenceContextContract,
        current_owner: str,
    ) -> None:
        """Responsibilities: _owner resolution context initialization_."""
        self._ownership = ownership
        self._current_owner = current_owner

    def method_return_owner(self, function: ast.AST) -> str:
        """Responsibilities: _method return owner lookup_."""
        if type(function) is not ast.Attribute:
            return ""
        owner = self.attribute_owner(function.value)
        return self._ownership.name_resolver().method_return_owner(function.attr, owner)

    def collection_element_owner(self, attribute: ast.Attribute) -> str:
        """Responsibilities: _attribute collection ownership_."""
        base_owner = self.attribute_owner(attribute.value)
        if not base_owner:
            return ""
        property_name = f"{base_owner}.{attribute.attr}"
        owner = self._ownership.bindings().collection_element_owner(property_name, attribute)
        if not owner:
            owner = self._ownership.properties().owner(base_owner, attribute.attr, attribute)
        return owner

    def attribute_owner(self, expression: ast.AST) -> str:
        """Responsibilities: _attribute expression owner lookup_."""
        if type(expression) is ast.Name:
            return self._name_attribute_owner(expression)
        if type(expression) is ast.Attribute:
            return self._nested_attribute_owner(expression)
        if type(expression) is ast.Call:
            return self._call_owner(expression)
        return ""
