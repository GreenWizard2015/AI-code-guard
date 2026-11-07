from __future__ import annotations

import ast

from implementation.references.constants import UNKNOWN_OWNER_TYPES
from implementation.references.context.python_scoped_owner_state import PythonScopedOwnerState
from implementation.references.protocols import (
    PythonLexicalScopeContract,
    PythonReferenceBindingsContract,
    PythonScopedOwnerStateContract,
)


class PythonReferenceBindings(PythonReferenceBindingsContract):
    """Responsibilities: _instance binding records_, _collection element ownership_."""

    _instances: dict[str, str]
    _collection_elements: dict[str, str]
    _lexical_scope: PythonLexicalScopeContract
    _instance_state: PythonScopedOwnerStateContract
    _collection_state: PythonScopedOwnerStateContract

    def _record_instance(self, name: str, owner: str, node: ast.AST) -> None:
        """Responsibilities: _scoped instance owner recording_."""
        if not name:
            return
        normalized_owner = owner
        if owner in UNKNOWN_OWNER_TYPES:
            normalized_owner = ""
        scope = self._lexical_scope.recording_scope(node)
        self._instance_state.record_at_scope(scope, name, normalized_owner, node)

    def _record_collection_element(self, name: str, owner: str, node: ast.AST) -> None:
        """Responsibilities: _scoped collection element recording_."""
        if not name:
            return
        normalized_owner = owner
        if owner in UNKNOWN_OWNER_TYPES:
            normalized_owner = ""
        scope = self._lexical_scope.recording_scope(node)
        self._collection_state.record_at_scope(scope, name, normalized_owner, node)

    def __init__(
        self,
        lexical_scope: PythonLexicalScopeContract,
        instances: dict[str, str],
        collection_elements: dict[str, str],
    ) -> None:
        """Responsibilities: _binding state ownership_."""
        self._lexical_scope = lexical_scope
        self._instances = instances
        self._collection_elements = collection_elements
        self._instance_state = PythonScopedOwnerState({}, {}, instances, include_module_name=True)
        self._collection_state = PythonScopedOwnerState({}, {}, collection_elements, include_module_name=False)

    def instance_owner(self, name: str, node: ast.AST) -> str:
        """Responsibilities: _lexical instance owner lookup_."""
        result = self._instance_state.owner_resolution(self._lexical_scope.scope_chain(node), name, node)
        owner = result.owner_name()
        if owner in UNKNOWN_OWNER_TYPES:
            return ""
        return owner

    def record_binding(self, name: str, owner: str, collection_owner: str, node: ast.AST) -> None:
        """Responsibilities: _binding records_."""
        self._record_instance(name, owner, node)
        self._record_collection_element(name, collection_owner, node)

    def collection_element_owner(self, name: str, node: ast.AST) -> str:
        """Responsibilities: _collection owner lookup_."""
        result = self._collection_state.owner_resolution(self._lexical_scope.scope_chain(node), name, node)
        owner = result.owner_name()
        if owner in UNKNOWN_OWNER_TYPES:
            return ""
        return owner

    def instance_binding_present(self, name: str, node: ast.AST) -> bool:
        """Responsibilities: _instance binding existence lookup_."""
        result = self._instance_state.owner_resolution(self._lexical_scope.scope_chain(node), name, node)
        if result.present():
            return True
        return name in self._instances

    def collection_state(self) -> PythonScopedOwnerStateContract:
        """Responsibilities: _collection element state access_."""
        return self._collection_state
