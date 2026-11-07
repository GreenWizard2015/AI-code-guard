from __future__ import annotations

import ast

from implementation.ast.protocols import PythonAstNodeIndexContract
from implementation.references.instances.python_class_property_types import (
    PythonClassPropertyTypes,
)
from implementation.rules.type_rule_protocols import PythonPropertyTypeContract


class PythonPropertyTypeCollector:
    """Responsibilities: _class property collection_, _initializer assignment inference_."""

    def __init__(
        self,
        tree: ast.Module,
        type_resolver: PythonPropertyTypeContract,
        node_index: PythonAstNodeIndexContract,
    ) -> None:
        """Responsibilities: _initialization source tree type_."""
        self._tree: ast.Module = tree
        self._node_index: PythonAstNodeIndexContract = node_index
        self._type_resolver: PythonPropertyTypeContract = type_resolver
        self._properties: dict[str, str] = {}

    def collect_properties(self) -> dict[str, str]:
        """Responsibilities: _collection property types every_."""
        self._properties.clear()
        for node in self._node_index.nodes(self._tree):
            if type(node) is ast.ClassDef:
                self.collect_class_properties(node)
        return dict(self._properties)

    def collect_class_properties(self, node: ast.ClassDef) -> None:
        """Responsibilities: _collection declared initialization properties_."""
        class_properties = PythonClassPropertyTypes(
            node,
            self._type_resolver,
            self._node_index,
        )
        self._properties.update(class_properties.collect_class_members())
        self._properties.update(class_properties.collect_initializer_properties())
