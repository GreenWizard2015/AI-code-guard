from __future__ import annotations

import ast
from typing import Any

from implementation.references.constants import UNKNOWN_OWNER_TYPES
from implementation.references.instances.python_collection_element_owner import (
    PythonCollectionElementOwner,
)
from implementation.references.protocols import (
    PythonCollectionElementOwnerContract,
    PythonReferenceOwnershipContract,
)
from implementation.references.protocols import PythonReferenceOwnershipOptionsContract
from implementation.references.context.python_reference_ownership import (
    PythonReferenceOwnership,
)


class PythonReferenceContext:
    """Responsibilities: _attribute type inference_, _callable output inference_."""

    _ownership: PythonReferenceOwnershipContract
    collection_owner: PythonCollectionElementOwnerContract

    def _call_owner(self, value: ast.Call, current_owner: str) -> str:
        """Responsibilities: _resolution owner output invocation_."""
        if type(value.func) is ast.Name:
            return self._ownership.name_resolver().call_return_owner(
                value.func, value, fallback_to_name=True
            )
        return self._method_return_owner(value.func, current_owner)

    def _nested_attribute_owner(self, value: ast.Attribute, current_owner: str) -> str:
        """Responsibilities: _resolution owners through nested_."""
        base_owner: Any = self.attribute_owner(value.value, current_owner)
        if not base_owner:
            return ""
        return self._ownership._property_owner(base_owner, value.attr, value)

    def _method_return_owner(self, function: ast.AST, current_owner: str) -> str:
        """Responsibilities: _resolution owner type output_."""
        if type(function) is not ast.Attribute:
            return ""
        owner: Any = self.attribute_owner(function.value, current_owner)
        return self._ownership.name_resolver().method_return_owner(function.attr, owner)

    def _name_attribute_owner(self, value: ast.Name, current_owner: str) -> str:
        """Responsibilities: _named attribute owner lookup_."""
        instance_owner: Any = self._ownership.instance_owner(value.id, value)
        if instance_owner in UNKNOWN_OWNER_TYPES:
            return ""
        if instance_owner:
            return instance_owner
        if self._ownership._instance_binding_present(value.id, value):
            return ""
        if value.id in {"self", "cls"}:
            return current_owner
        return instance_owner

    def __init__(self, options: PythonReferenceOwnershipOptionsContract) -> None:
        """Responsibilities: _initialization aliases instances properties_."""
        self._ownership: PythonReferenceOwnershipContract = PythonReferenceOwnership(
            options
        )
        self.collection_owner: PythonCollectionElementOwnerContract = (
            PythonCollectionElementOwner(self)
        )

    def attribute_owner(self, value: ast.AST, current_owner: str) -> str:
        """Responsibilities: _resolution owner represented attribute_."""
        if type(value) is ast.Name:
            return self._name_attribute_owner(value, current_owner)
        if type(value) is ast.Attribute:
            return self._nested_attribute_owner(value, current_owner)
        if type(value) is ast.Call:
            return self._call_owner(value, current_owner)
        return ""

    def reference_ownership(self) -> PythonReferenceOwnershipContract:
        """Responsibilities: _reference owner operations_."""
        return self._ownership

    def collection_element_owner(self, value: ast.AST, current_owner: str) -> str:
        """Responsibilities: _collection element owner resolution_."""
        owner = self.collection_owner.owner(value, current_owner)
        if owner in UNKNOWN_OWNER_TYPES:
            return ""
        return owner
