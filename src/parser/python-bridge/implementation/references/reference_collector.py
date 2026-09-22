from __future__ import annotations


from dataclasses import dataclass, field
from typing import Any, cast
from implementation.references.call_returns import CallReturns
from implementation.references.instance_collector import PythonInstanceCollector
from implementation.references.property_type_collector import (
    PythonPropertyTypeCollector,
)
from implementation.references.property_type_resolver import PythonPropertyType
from implementation.references.reference_builder import PythonReference
from implementation.references.reference_context import PythonReferenceContext
from implementation.references.reference_state import PythonReferenceState
from implementation.ast.annotation_resolver import AnnotationNames
from implementation.ast.node_index import PythonAstNodeIndex
from implementation.ast.protocols import PythonAstNodeIndexProtocol
from implementation.types import JsonObject
import ast


@dataclass
class PythonReferenceCollector:
    """Responsibilities: _construction Python reference context_."""

    tree: ast.Module
    call_returns: CallReturns
    _state: PythonReferenceState = field(default_factory=PythonReferenceState)
    node_index: PythonAstNodeIndexProtocol = field(default_factory=PythonAstNodeIndex)

    def _import_aliases(self) -> dict[str, str]:
        """Responsibilities: _collection import aliases module_."""
        aliases: dict[str, str] = {}
        for node in self.tree.body:
            if type(node) is not ast.ImportFrom:
                continue
            for alias in node.names:
                if alias.name != "*":
                    aliases[alias.asname or alias.name] = alias.name
        return aliases

    def _reference_context(
        self, annotation_resolver: AnnotationNames
    ) -> PythonReferenceContext:
        """Responsibilities: _creation shared context usage_."""
        aliases: Any = self._import_aliases()
        class_names: Any = {
            node.name
            for node in self.node_index.nodes(self.tree)
            if type(node) is ast.ClassDef
        }
        class_names.update(aliases)
        type_resolver: Any = PythonPropertyType(
            aliases, class_names, annotation_resolver
        )
        property_collector: Any = PythonPropertyTypeCollector(
            self.tree, type_resolver, self.node_index
        )
        properties: Any = property_collector.collect_properties()
        return PythonReferenceContext(aliases, {}, properties, {})

    def _append_call_args(self, node: ast.AST, owner: str) -> None:
        """Responsibilities: _collection references invocation arguments_."""
        if type(node) is not ast.Call:
            return
        values: Any = [*node.args, *(item.value for item in node.keywords)]
        for value in values:
            reference: Any = self.reference_builder().for_expression(
                value, value.lineno - 1, owner
            )
            if reference:
                self._state.references.append(reference)

    def _container_values(self, node: ast.AST) -> list[ast.expr]:
        """Responsibilities: _extraction values supported container_."""
        if type(node) is ast.Dict:
            return [value for value in node.values if value is not None]
        if type(node) in (ast.List, ast.Set, ast.Tuple):
            return node.elts
        return []

    def _append_container(self, node: ast.AST, owner: str) -> None:
        """Responsibilities: _collection references nested container_."""
        values: Any = self._container_values(node)
        if not values:
            return
        for value in values:
            reference: Any = self.reference_builder().for_expression(
                value, node.lineno - 1, owner
            )
            if reference:
                self._state.references.append(reference)

    def _append_node(self, node: ast.AST, owner: str) -> None:
        """Responsibilities: _AST node invocation dispatch_."""
        if type(node) is ast.Call:
            reference: Any = self.reference_builder().for_call(node, owner)
            if reference:
                self._state.references.append(reference)
            self._append_call_args(node, owner)
            return
        if type(node) in (ast.Assign, ast.AnnAssign, ast.Return, ast.keyword):
            value_reference: Any = self.reference_builder().for_value(node, owner)
            if value_reference:
                self._state.references.append(value_reference)
            return
        if type(node) in (ast.Dict, ast.List, ast.Set, ast.Tuple):
            self._append_container(node, owner)

    def _class_owner(self, node: ast.AST, owner: str) -> str:
        """Responsibilities: _owner entering Python update_."""
        if type(node) is ast.ClassDef:
            return node.name
        return owner

    def _collect_references(self, node: ast.AST, owner: str = "") -> None:
        """Responsibilities: _recursively collection references preservation_."""
        current_owner: Any = self._class_owner(node, owner)
        self._append_node(node, current_owner)
        for child in ast.iter_child_nodes(node):
            self._collect_references(child, current_owner)

    def context(self) -> PythonReferenceContext:
        """Responsibilities: _output initialization reference-resolution context_."""
        return cast(PythonReferenceContext, self._state.context)

    def reference_builder(self) -> PythonReference:
        """Responsibilities: _creation builder normalization reference_."""
        return cast(PythonReference, self._state.builder)

    def collect_references(self) -> list[JsonObject]:
        """Responsibilities: _collection output normalization callable_."""
        annotation_resolver: Any = AnnotationNames()
        self._state.context = self._reference_context(annotation_resolver)
        self._state.builder = PythonReference(self.context())
        self._state.references.clear()
        self.call_returns.reset_call_returns(self.context())
        self.call_returns.collect_call_returns(self.tree, self.context())
        instances: Any = PythonInstanceCollector(self.tree, self.context())
        instances.collect_instances(annotation_resolver)
        instances.collect_for_aliases()
        self._collect_references(self.tree)
        return self._state.references
