from __future__ import annotations

import ast

from implementation.references.constants import UNKNOWN_OWNER_TYPES
from implementation.references.context.python_scoped_owner_state import PythonScopedOwnerState
from implementation.references.protocols import (
    PythonReferencePropertiesContract,
    PythonScopedOwnerStateContract,
)


class PythonReferenceProperties(PythonReferencePropertiesContract):
    """Responsibilities: _property ownership_, _collection element types_."""

    _properties: dict[str, str]
    _property_state: PythonScopedOwnerStateContract
    _collection_state: PythonScopedOwnerStateContract

    def __init__(
        self,
        properties: dict[str, str],
        collection_state: PythonScopedOwnerStateContract,
    ) -> None:
        """Responsibilities: _property type state initialization_."""
        self._properties = properties
        self._property_state = PythonScopedOwnerState({}, {}, dict(properties), include_module_name=True)
        self._collection_state = collection_state

    def owner(self, owner: str, property_name: str, node: ast.AST) -> str:
        """Responsibilities: _positioned property owner lookup_."""
        key = f"{owner}.{property_name}"
        result = self._property_state.owner_resolution(["module"], key, node)
        owner_type = result.owner_name()
        if not owner_type:
            owner_type = self._properties.get(key, "")
        if owner_type in UNKNOWN_OWNER_TYPES:
            return ""
        return owner_type

    def record(self, owner: str, property_name: str, value: str, node: ast.AST) -> None:
        """Responsibilities: _positioned property owner recording_."""
        if not owner or not property_name:
            return
        normalized_value = value
        if value in UNKNOWN_OWNER_TYPES:
            normalized_value = ""
        self._record_type(f"{owner}.{property_name}", normalized_value, node)

    def _record_type(self, name: str, owner: str, node: ast.AST) -> None:
        """Responsibilities: _property type recording_."""
        if not name or not owner:
            return
        self._properties.update({name: owner})
        self._property_state.record_at_scope("module", name, owner, node)

    def record_type(self, name: str, owner: str, node: ast.AST) -> None:
        """Responsibilities: _annotated property recording_."""
        if owner in UNKNOWN_OWNER_TYPES:
            owner = ""
        self._record_type(name, owner, node)

    def record_elements(self, name: str, element_type: str, node: ast.AST) -> None:
        """Responsibilities: _annotated property collection elements_."""
        if not name or not element_type or element_type in UNKNOWN_OWNER_TYPES:
            return
        self._collection_state.record_at_scope("module", name, element_type, node)
