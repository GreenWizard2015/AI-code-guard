from __future__ import annotations

import ast

from implementation.references.constants import UNKNOWN_OWNER_TYPES
from implementation.references.context.python_lexical_scope import PythonLexicalScope
from implementation.references.context.python_owner_resolution import (
    PythonOwnerResolution,
)
from implementation.references.context.python_reference_bindings import PythonReferenceBindings
from implementation.references.context.python_reference_name_index import PythonReferenceNameIndex
from implementation.references.context.python_reference_properties import PythonReferenceProperties
from implementation.references.protocols import (
    PythonReferenceBindingsContract,
    PythonReferenceNameResolverContract,
    PythonReferenceOwnershipOptionsContract,
    PythonReferencePropertiesContract,
)


class PythonReferenceContext:
    """Responsibilities: _attribute type inference_, _callable output inference_."""

    _bindings: PythonReferenceBindingsContract
    _properties: PythonReferencePropertiesContract
    _name_resolver: PythonReferenceNameResolverContract

    def __init__(self, options: PythonReferenceOwnershipOptionsContract) -> None:
        """Responsibilities: _initialization aliases instances properties_."""
        symbols = options.symbol_tables()
        instances = dict(symbols.instance_types())
        properties = dict(symbols.property_types())
        collection_elements = dict(symbols.collection_types())
        lexical_scope = PythonLexicalScope(options.ast_index())
        name_resolver = PythonReferenceNameIndex(
            dict(symbols.alias_table()),
            options.call_return_values(),
            lexical_scope,
        )
        bindings = PythonReferenceBindings(lexical_scope, instances, collection_elements)
        property_state = PythonReferenceProperties(properties, bindings.collection_state())
        self._bindings = bindings
        self._properties = property_state
        self._name_resolver = name_resolver

    def bindings(self) -> PythonReferenceBindingsContract:
        """Responsibilities: _reference binding lookup_."""
        return self._bindings

    def properties(self) -> PythonReferencePropertiesContract:
        """Responsibilities: _reference property lookup_."""
        return self._properties

    def name_resolver(self) -> PythonReferenceNameResolverContract:
        """Responsibilities: _reference name resolution_."""
        return self._name_resolver

    def attribute_owner(self, value: ast.AST, current_owner: str) -> str:
        """Responsibilities: _resolution owner represented attribute_."""
        resolution = PythonOwnerResolution(self, current_owner)
        return resolution.attribute_owner(value)

    def collection_element_owner(self, value: ast.AST, current_owner: str) -> str:
        """Responsibilities: _collection element owner resolution_."""
        if type(value) is ast.Name:
            owner = self._bindings.collection_element_owner(value.id, value)
        else:
            if type(value) is ast.Attribute:
                resolution = PythonOwnerResolution(self, current_owner)
                owner = resolution.collection_element_owner(value)
            else:
                owner = ""
        if owner in UNKNOWN_OWNER_TYPES:
            return ""
        return owner
