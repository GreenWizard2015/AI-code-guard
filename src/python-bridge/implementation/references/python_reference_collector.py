from __future__ import annotations

import ast
from dataclasses import dataclass, field
from time import perf_counter

from implementation.ast.protocols import PythonAstNodeIndexContract
from implementation.ast.type_declarations.annotation_names import AnnotationNames
from implementation.references.alias_types import CallablePythonReferenceOperation
from implementation.references.instances.python_instance_collector import (
    PythonInstanceCollector,
)
from implementation.references.protocols import (
    PythonAnnotationResolverContract,
    PythonCallReturnsContract,
    PythonCallReturnStateContract,
    PythonReferenceBuilderContract,
    PythonReferenceContextContract,
    PythonReferenceSourceContract,
)
from implementation.references.python_call_assignment import PythonCallAssignment
from implementation.references.python_call_binding import PythonCallBinding
from implementation.references.python_call_reference_options import (
    PythonCallReferenceOptions,
)
from implementation.references.python_reference import PythonReference
from implementation.references.python_reference_source import (
    PythonReferenceSource,
)
from implementation.rules.constants import PYTHON_REFERENCE_COLLECTION_STAGE
from implementation.types import JsonObject, PythonASTLocatedNode


@dataclass
class PythonReferenceState:
    """Responsibilities: _reference context storage_, _storage reference builders records_."""

    context: PythonReferenceContextContract = field(init=False)
    builder: PythonReferenceBuilderContract = field(init=False)
    references: list[JsonObject] = field(default_factory=list)
    current_owner: str = ""


class PythonReferenceCollector:
    """Responsibilities: _reference context construction_, _timed reference collection_."""

    _tree: ast.Module
    _call_returns: PythonCallReturnsContract
    _call_return_state: PythonCallReturnStateContract
    _state: PythonReferenceState
    _node_index: PythonAstNodeIndexContract
    _context_source: PythonReferenceSourceContract

    def _timed(self, name: str, operation: CallablePythonReferenceOperation) -> None:
        """Responsibilities: _reference collection timing_."""
        started = perf_counter()
        try:
            operation()
        finally:
            self._timings.update({name: (perf_counter() - started) * 1000})

    def _append_call_args(self, call_expression: ast.AST) -> None:
        """Responsibilities: _collection references invocation arguments_."""
        if type(call_expression) is not ast.Call:
            return
        values: list[ast.expr] = [
            *call_expression.args,
            *(item.value for item in call_expression.keywords),
        ]
        for value in values:
            reference = self.python_reference().for_expression(
                value,
                self._state.current_owner,
            )
            if reference:
                self._state.references.append(reference)

    def _container_values(self, container_expression: ast.AST) -> list[ast.expr]:
        """Responsibilities: _extraction values supported container_."""
        if type(container_expression) is ast.Dict:
            return [value for value in container_expression.values if value is not None]
        if type(container_expression) is ast.List:
            return container_expression.elts
        if type(container_expression) is ast.Set:
            return container_expression.elts
        if type(container_expression) is ast.Tuple:
            return container_expression.elts
        return []

    def _append_container(self, container_expression: ast.AST) -> None:
        """Responsibilities: _collection references nested container_."""
        values = self._container_values(container_expression)
        if not values:
            return
        for value in values:
            reference = self.python_reference().for_expression(
                value,
                self._state.current_owner,
            )
            if reference:
                self._state.references.append(reference)

    def _append_call(self, call_expression: ast.Call) -> None:
        """Responsibilities: _call reference collection_."""
        assignment = PythonCallAssignment(call_expression, self._node_index)
        binding = PythonCallBinding(
            assignment.target_name(),
            assignment.annotation_name(),
            self._deferred_callable(call_expression),
        )
        options = PythonCallReferenceOptions(
            call_expression,
            self._state.current_owner,
            binding,
        )
        reference = self.python_reference().for_call(options)
        if reference:
            self._state.references.append(reference)
        self._append_call_args(call_expression)

    def _append_value_reference(self, value_statement: PythonASTLocatedNode) -> None:
        """Responsibilities: _assigned value reference collection_."""
        reference = self.python_reference().for_value(
            value_statement,
            self._state.current_owner,
        )
        if reference:
            self._state.references.append(reference)

    def _append_node(self, ast_node: ast.AST) -> None:
        """Responsibilities: _AST reference dispatch_."""
        match ast_node:
            case ast.Call() as call_expression:
                self._append_call(call_expression)
            case (ast.Assign() | ast.AnnAssign() | ast.Return() | ast.keyword()) as value_statement:
                self._append_value_reference(value_statement)
            case ast.Dict() | ast.List() | ast.Set() | ast.Tuple() as container_expression:
                self._append_container(container_expression)

    def _deferred_callable(self, call_site: ast.AST) -> bool:
        """Responsibilities: _deferred call scope detection_."""
        callable_count = 0
        current = call_site
        while True:
            parents = self._node_index.parents(current)
            if not parents:
                return False
            current = parents[-1]
            if type(current) is ast.Lambda:
                return True
            if type(current) in (ast.FunctionDef, ast.AsyncFunctionDef):
                callable_count += 1
                if callable_count > 1:
                    return True

    def _collect_references(self, source_node: ast.AST) -> None:
        """Responsibilities: _ordered reference traversal_, _class owner restoration_."""
        original_owner = self._state.current_owner
        pending = [(source_node, original_owner)]
        try:
            while pending:
                current, owner = pending.pop()
                if type(current) is ast.ClassDef:
                    self._state.current_owner = current.name
                else:
                    self._state.current_owner = owner
                self._append_node(current)
                pending.extend(
                    (child, self._state.current_owner) for child in reversed(self._node_index.children(current))
                )
        finally:
            self._state.current_owner = original_owner

    def _collect_reference_data(
        self,
        annotation_resolver: PythonAnnotationResolverContract,
    ) -> None:
        """Responsibilities: _reference data collection_."""
        instances = PythonInstanceCollector(self._tree, self.context(), self._node_index)
        self._timed(
            "call-returns",
            lambda: self._call_returns.collect_call_returns(self._tree, self.context()),
        )
        self._timed(
            "instances",
            lambda: instances.collect_instances(annotation_resolver),
        )
        self._timed("instance-aliases", instances.collect_for_aliases)
        self._timed(
            PYTHON_REFERENCE_COLLECTION_STAGE,
            lambda: self._collect_references(self._tree),
        )

    def __init__(
        self,
        tree: ast.Module,
        call_returns: PythonCallReturnsContract,
        node_index: PythonAstNodeIndexContract,
        call_return_state: PythonCallReturnStateContract,
    ) -> None:
        """Responsibilities: _initialization reference collection dependencies_."""
        self._tree: ast.Module = tree
        self._call_returns: PythonCallReturnsContract = call_returns
        self._call_return_state: PythonCallReturnStateContract = call_return_state
        self._state: PythonReferenceState = PythonReferenceState()
        self._node_index: PythonAstNodeIndexContract = node_index
        self._context_source = PythonReferenceSource(
            tree,
            node_index,
            self._call_return_state,
        )
        self._timings: dict[str, float] = {}

    def timings_data(self) -> dict[str, float]:
        """Responsibilities: _reference timing output_."""
        return {f"call-references.{name}": duration for name, duration in self._timings.items()}

    def context(self) -> PythonReferenceContextContract:
        """Responsibilities: _output initialization reference-resolution context_."""
        return self._state.context

    def python_reference(self) -> PythonReferenceBuilderContract:
        """Responsibilities: _creation builder normalization reference_."""
        return self._state.builder

    def collect_references(self) -> list[JsonObject]:
        """Responsibilities: _collection output normalization callable_."""
        annotation_resolver = AnnotationNames(self._node_index)
        self._state.context = self._context_source.context(annotation_resolver)
        self._state.builder = PythonReference(self.context())
        self._state.references.clear()
        self._call_return_state.state_cleanup()
        self._timings.clear()
        self._collect_reference_data(annotation_resolver)
        return self._state.references
