from __future__ import annotations

import ast
from time import perf_counter
from typing import Any

from implementation.ast.type_declarations.annotation_names import AnnotationNames
from implementation.protocols import (
    PythonAstNodeIndexContract,
)
from implementation.references.protocols import (
    PythonAnnotationResolverContract,
    PythonCallReturnsContract,
    PythonCallReturnStateContract,
    PythonReferenceBuilderContract,
    PythonReferenceContextContract,
    PythonReferenceOperation,
)
from implementation.references.python_call_return_state_adapter import (
    PythonCallReturnStateAdapter,
)
from implementation.references.instances.python_instance_collector import (
    PythonInstanceCollector,
)
from implementation.references.instances.python_property_type import PythonPropertyType
from implementation.references.instances.python_property_type_collector import (
    PythonPropertyTypeCollector,
)
from implementation.references.python_reference import PythonReference
from implementation.references.python_reference_context import (
    PythonReferenceContext,
)
from implementation.references.context.python_reference_context_options import (
    PythonReferenceContextOptions,
)
from implementation.references.context.python_reference_symbol_tables import (
    PythonReferenceSymbolTables,
)
from implementation.references.reference_state import PythonReferenceState
from implementation.rules.constants import PYTHON_REFERENCE_COLLECTION_STAGE
from implementation.types import JsonObject


class PythonReferenceCollector:
    """Responsibilities: _reference context construction_, _timed reference collection_."""

    tree: ast.Module
    call_returns: PythonCallReturnsContract
    call_return_state: PythonCallReturnStateContract
    _state: PythonReferenceState
    node_index: PythonAstNodeIndexContract

    def _timed(self, name: str, operation: PythonReferenceOperation) -> None:
        """Responsibilities: _reference collection timing_."""
        started = perf_counter()
        try:
            operation()
        finally:
            self.timings[name] = (perf_counter() - started) * 1000

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

    def _reference_class_names(self, aliases: dict[str, str]) -> set[str]:
        """Responsibilities: _collection reference class names_."""
        class_names = {
            node.name
            for node in self.node_index.nodes(self.tree)
            if type(node) is ast.ClassDef
        }
        class_names.update(aliases)
        return class_names

    def _reference_properties(
        self,
        aliases: dict[str, str],
        annotation_resolver: PythonAnnotationResolverContract,
    ) -> dict[str, str]:
        """Responsibilities: _collection reference properties_."""
        type_resolver = PythonPropertyType(
            aliases, self._reference_class_names(aliases), annotation_resolver
        )
        property_collector = PythonPropertyTypeCollector(
            self.tree, type_resolver, self.node_index
        )
        return property_collector.collect_properties()

    def _python_reference_context(
        self, annotation_resolver: PythonAnnotationResolverContract
    ) -> PythonReferenceContextContract:
        """Responsibilities: _creation shared context usage_."""
        aliases: Any = self._import_aliases()
        properties: Any = self._reference_properties(aliases, annotation_resolver)
        return PythonReferenceContext(
            PythonReferenceContextOptions(
                PythonReferenceSymbolTables(aliases, {}, properties, {}),
                PythonCallReturnStateAdapter(self.call_return_state),
                self.node_index,
            )
        )

    def _append_call_args(self, node: ast.AST, owner: str) -> None:
        """Responsibilities: _collection references invocation arguments_."""
        if type(node) is not ast.Call:
            return
        values: Any = [*node.args, *(item.value for item in node.keywords)]
        for value in values:
            reference: Any = self.python_reference().for_expression(
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
            reference: Any = self.python_reference().for_expression(
                value, node.lineno - 1, owner
            )
            if reference:
                self._state.references.append(reference)

    def _append_node(self, node: ast.AST, owner: str) -> None:
        """Responsibilities: _AST node invocation dispatch_."""
        if type(node) is ast.Call:
            reference: Any = self.python_reference().for_call(node, owner)
            if reference:
                self._state.references.append(reference)
            self._append_call_args(node, owner)
            return
        if type(node) in (ast.Assign, ast.AnnAssign, ast.Return, ast.keyword):
            value_reference: Any = self.python_reference().for_value(node, owner)
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
        for child in self.node_index.children(node):
            self._collect_references(child, current_owner)

    def _collect_reference_data(
        self, annotation_resolver: PythonAnnotationResolverContract
    ) -> None:
        """Responsibilities: _reference data collection_."""
        instances = PythonInstanceCollector(self.tree, self.context(), self.node_index)
        self._timed(
            "call-returns",
            lambda: self.call_returns.collect_call_returns(self.tree, self.context()),
        )
        self._timed(
            "instances", lambda: instances.collect_instances(annotation_resolver)
        )
        self._timed("instance-aliases", instances.collect_for_aliases)
        self._timed(
            PYTHON_REFERENCE_COLLECTION_STAGE,
            lambda: self._collect_references(self.tree),
        )

    def __init__(
        self,
        tree: ast.Module,
        call_returns: PythonCallReturnsContract,
        node_index: PythonAstNodeIndexContract,
        *provided_states: PythonCallReturnStateContract,
    ) -> None:
        """Responsibilities: _initialization reference collection dependencies_."""
        self.tree: ast.Module = tree
        self.call_returns: PythonCallReturnsContract = call_returns
        self.call_return_state: PythonCallReturnStateContract = next(
            iter(provided_states), call_returns.return_state()
        )
        self._state: PythonReferenceState = PythonReferenceState()
        self.node_index: PythonAstNodeIndexContract = node_index
        self.timings: dict[str, float] = {}

    def timings_data(self) -> dict[str, float]:
        """Responsibilities: _reference timing output_."""
        return {
            f"call-references.{name}": duration
            for name, duration in self.timings.items()
        }

    def context(self) -> PythonReferenceContextContract:
        """Responsibilities: _output initialization reference-resolution context_."""
        return self._state.context

    def python_reference(self) -> PythonReferenceBuilderContract:
        """Responsibilities: _creation builder normalization reference_."""
        return self._state.builder

    def collect_references(self) -> list[JsonObject]:
        """Responsibilities: _collection output normalization callable_."""
        annotation_resolver = AnnotationNames()
        self._state.context = self._python_reference_context(annotation_resolver)
        self._state.builder = PythonReference(self.context())
        self._state.references.clear()
        self.call_return_state.state_cleanup()
        self.timings.clear()
        self._collect_reference_data(annotation_resolver)
        return self._state.references
