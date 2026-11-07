from __future__ import annotations

import ast

from implementation.ast.protocols import PythonAstNodeIndexContract
from implementation.references.context.python_reference_context_options import (
    PythonReferenceContextOptions,
)
from implementation.references.context.python_reference_symbol_tables import (
    PythonReferenceSymbolTables,
)
from implementation.references.instances.python_property_type import PythonPropertyType
from implementation.references.instances.python_property_type_collector import (
    PythonPropertyTypeCollector,
)
from implementation.references.protocols import (
    PythonAnnotationResolverContract,
    PythonCallReturnStateContract,
    PythonReferenceContextContract,
)
from implementation.references.python_reference_context import PythonReferenceContext


class PythonReferenceSource:
    """Responsibilities: _Python reference source_, _derived reference metadata_."""

    _tree: ast.Module
    _node_index: PythonAstNodeIndexContract
    _call_return_state: PythonCallReturnStateContract

    def _class_names(self, aliases: dict[str, str]) -> set[str]:
        """Responsibilities: _reference class name collection_."""
        names = {node.name for node in self._node_index.nodes(self._tree) if type(node) is ast.ClassDef}
        names.update(aliases)
        return names

    def __init__(
        self,
        tree: ast.Module,
        node_index: PythonAstNodeIndexContract,
        call_return_state: PythonCallReturnStateContract,
    ) -> None:
        """Responsibilities: _reference context dependencies_."""
        self._tree = tree
        self._node_index = node_index
        self._call_return_state = call_return_state

    def aliases(self) -> dict[str, str]:
        """Responsibilities: _source import aliases_."""
        aliases: dict[str, str] = {}
        for node in self._tree.body:
            if type(node) is not ast.ImportFrom:
                continue
            for alias in node.names:
                if alias.name != "*":
                    aliases[alias.asname or alias.name] = alias.name
        return aliases

    def context(
        self,
        annotation_resolver: PythonAnnotationResolverContract,
    ) -> PythonReferenceContextContract:
        """Responsibilities: _source reference context_."""
        aliases = self.aliases()
        type_resolver = PythonPropertyType(
            aliases,
            self._class_names(aliases),
            annotation_resolver,
        )
        property_collector = PythonPropertyTypeCollector(
            self._tree,
            type_resolver,
            self._node_index,
        )
        properties = property_collector.collect_properties()
        tables = PythonReferenceSymbolTables(aliases, {}, properties, {})
        options = PythonReferenceContextOptions(
            tables,
            self._call_return_state,
            self._node_index,
        )
        return PythonReferenceContext(options)
