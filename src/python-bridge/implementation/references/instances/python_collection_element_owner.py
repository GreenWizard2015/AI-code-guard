from __future__ import annotations

import ast

from implementation.references.protocols import (
    PythonCollectionElementOwnerContract,
    PythonReferenceContextContract,
)


class PythonCollectionElementOwner(PythonCollectionElementOwnerContract):
    """Responsibilities: _element owner resolution_, _current owner preservation_."""

    _context: PythonReferenceContextContract

    def __init__(self, context: PythonReferenceContextContract) -> None:
        """Responsibilities: _collection owner dependencies_."""
        self._context: PythonReferenceContextContract = context

    def owner(self, value: ast.AST, current_owner: str) -> str:
        """Responsibilities: _collection element owner lookup_."""
        if type(value) is ast.Name:
            return self._context.reference_ownership()._collection_element_owner(
                value.id, value
            )
        if type(value) is ast.Attribute:
            base_owner = self._context.attribute_owner(value.value, current_owner)
            if not base_owner:
                return ""
            return self._context.reference_ownership()._property_owner(
                base_owner, value.attr, value
            )
        return ""
