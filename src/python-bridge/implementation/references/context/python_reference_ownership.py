from __future__ import annotations

import ast

from implementation.protocols import PythonAstNodeIndexContract
from implementation.references.constants import UNKNOWN_OWNER_TYPES
from implementation.references.protocols import (
    PythonLexicalScopeContract,
    PythonReferenceOwnershipOptionsContract,
    PythonReferenceNameResolverContract,
    PythonScopedOwnerStateContract,
)
from implementation.references.python_lexical_scope import PythonLexicalScope
from implementation.references.python_scoped_owner_state import (
    PythonScopedOwnerRecords,
    PythonScopedOwnerState,
)
from implementation.references.context.python_reference_name_index import (
    PythonReferenceNameIndex,
)


class PythonReferenceOwnership:
    """Responsibilities: _scoped instance ownership_, _property ownership_."""

    _instances: dict[str, str]
    _properties: dict[str, str]
    lexical_scope: PythonLexicalScopeContract
    instance_state: PythonScopedOwnerStateContract
    collection_state: PythonScopedOwnerStateContract
    property_state: PythonScopedOwnerStateContract
    _name_resolver: PythonReferenceNameResolverContract
    _properties: dict[str, str]
    _collection_elements: dict[str, str]
    node_index: PythonAstNodeIndexContract

    def _record_annotation(self, name: str, owner: str, node: ast.AST) -> None:
        """Responsibilities: _instance annotation recording_."""
        if owner in UNKNOWN_OWNER_TYPES:
            owner = ""
        scope = self.lexical_scope.recording_scope(node)
        self.instance_state.annotate_at_scope(scope, name, owner, node)

    def _record_element_annotation(self, name: str, owner: str, node: ast.AST) -> None:
        """Responsibilities: _collection annotation recording_."""
        if owner in UNKNOWN_OWNER_TYPES:
            owner = ""
        scope = self.lexical_scope.recording_scope(node)
        self.collection_state.annotate_at_scope(scope, name, owner, node)

    def _record_property(
        self, owner: str, property_name: str, value: str, node: ast.AST
    ) -> None:
        """Responsibilities: _positioned property owner recording_."""
        if not owner or not property_name:
            return
        if value in UNKNOWN_OWNER_TYPES:
            value = ""
        self.property_state.record_at_scope(
            "module", f"{owner}.{property_name}", value, node
        )

    def _property_owner(self, owner: str, property_name: str, node: ast.AST) -> str:
        """Responsibilities: _positioned property owner lookup_."""
        key = f"{owner}.{property_name}"
        result = self.property_state.owner_at_scopes(["module"], key, node)
        if not result:
            result = self._properties.get(key, "")
        if result in UNKNOWN_OWNER_TYPES:
            return ""
        return result

    def _record_property_type(self, name: str, owner: str, node: ast.AST) -> None:
        """Responsibilities: _property type recording_."""
        if not name or not owner:
            return
        if owner in UNKNOWN_OWNER_TYPES:
            owner = ""
        self._properties[name] = owner
        self.property_state.annotate_at_scope("module", name, owner, node)

    def _collection_element_owner(self, name: str, node: ast.AST) -> str:
        """Responsibilities: _lexical collection element ownership_."""
        owner = self.collection_state.owner_at_scopes(
            self.lexical_scope.scope_chain(node), name, node
        )
        if owner in UNKNOWN_OWNER_TYPES:
            return ""
        return owner

    def _instance_binding_present(self, name: str, node: ast.AST) -> bool:
        """Responsibilities: _lexical instance binding existence_."""
        scopes = self.lexical_scope.scope_chain(node)
        if self.instance_state.binding_present(scopes, name):
            return True
        if name in self._instances:
            return True
        return False

    def _record_instance(self, name: str, owner: str, node: ast.AST) -> None:
        """Responsibilities: _instance owner recording_."""
        if not name:
            return
        if owner in UNKNOWN_OWNER_TYPES:
            owner = ""
        scope = self.lexical_scope.recording_scope(node)
        self.instance_state.record_at_scope(scope, name, owner, node)

    def _record_collection_element(self, name: str, owner: str, node: ast.AST) -> None:
        """Responsibilities: _collection owner recording_."""
        if not name:
            return
        if owner in UNKNOWN_OWNER_TYPES:
            owner = ""
        scope = self.lexical_scope.recording_scope(node)
        self.collection_state.record_at_scope(scope, name, owner, node)

    def __init__(self, options: PythonReferenceOwnershipOptionsContract) -> None:
        """Responsibilities: _reference owner state initialization_."""
        symbol_tables = options.symbol_tables()
        self._instances: dict[str, str] = dict(symbol_tables.instance_types())
        self._properties: dict[str, str] = dict(symbol_tables.property_types())
        self._collection_elements: dict[str, str] = dict(
            symbol_tables.collection_types()
        )
        self.node_index: PythonAstNodeIndexContract = options.ast_index()
        self.lexical_scope: PythonLexicalScopeContract = PythonLexicalScope(
            self.node_index
        )
        self._name_resolver: PythonReferenceNameResolverContract = (
            PythonReferenceNameIndex(
                dict(symbol_tables.alias_table()),
                options.call_return_values(),
                self.lexical_scope,
            )
        )
        self.instance_state: PythonScopedOwnerStateContract = PythonScopedOwnerState(
            PythonScopedOwnerRecords({}, {}, self._instances, True)
        )
        self.collection_state: PythonScopedOwnerStateContract = PythonScopedOwnerState(
            PythonScopedOwnerRecords({}, {}, self._collection_elements, False)
        )
        self.property_state: PythonScopedOwnerStateContract = PythonScopedOwnerState(
            PythonScopedOwnerRecords({}, {}, dict(self._properties), True)
        )

    def instance_owner(self, name: str, node: ast.AST) -> str:
        """Responsibilities: _lexical instance owner lookup_."""
        owner = self.instance_state.owner_at_scopes(
            self.lexical_scope.scope_chain(node), name, node
        )
        if owner in UNKNOWN_OWNER_TYPES:
            return ""
        return owner

    def record_binding(
        self,
        name: str,
        owner: str,
        collection_owner: str,
        node: ast.AST,
    ) -> None:
        """Responsibilities: _instance bindings_, _collection bindings_."""
        self._record_instance(name, owner, node)
        self._record_collection_element(name, collection_owner, node)

    def name_resolver(self) -> PythonReferenceNameResolverContract:
        """Responsibilities: _reference name resolution access_."""
        return self._name_resolver
