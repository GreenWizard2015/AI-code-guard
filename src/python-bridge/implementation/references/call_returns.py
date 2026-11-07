from __future__ import annotations

import ast

from implementation.ast.protocols import PythonAstNodeIndexContract
from implementation.references.constants import REFERENCE_GENERICS
from implementation.references.protocols import (
    PythonAnnotationResolverContract,
    PythonCallReturnStateContract,
    PythonReferenceContextContract,
    PythonReferenceNameResolverContract,
)


class CallReturns:
    """Responsibilities: _collection callable output owners_, _output state reset_."""

    _values: dict[str, str]

    def _call_key(self, qualified_owner: str, function_name: str) -> str:
        """Responsibilities: _qualified callable output identity_."""
        if qualified_owner:
            return f"{qualified_owner}.{function_name}"
        return function_name

    def _resolved_return_owner(
        self,
        return_annotation: ast.expr,
        reference_names: PythonReferenceNameResolverContract,
    ) -> str:
        """Responsibilities: _callable return annotation resolution_."""
        return reference_names.annotation_name(
            self._annotation_resolver,
            return_annotation,
            set(REFERENCE_GENERICS),
        )

    def _record_return_owner(
        self,
        callable_node: ast.AST,
        name_resolver: PythonReferenceNameResolverContract,
        enclosing_class_name: str,
    ) -> None:
        """Responsibilities: _callable return owner recording_."""
        match callable_node:
            case ast.FunctionDef(name=name, returns=annotation) | ast.AsyncFunctionDef(
                name=name,
                returns=annotation,
            ):
                pass
            case _:
                return
        if annotation is None:
            return
        return_owner = self._resolved_return_owner(annotation, name_resolver)
        if not return_owner:
            return
        self.store(self._call_key(enclosing_class_name, name), return_owner)
        self.store(name_resolver.callable_key(callable_node), return_owner)

    def __init__(
        self,
        annotation_resolver: PythonAnnotationResolverContract,
        node_index: PythonAstNodeIndexContract,
    ) -> None:
        """Responsibilities: _annotation resolver initialization_."""
        self._annotation_resolver: PythonAnnotationResolverContract = annotation_resolver
        self._node_index: PythonAstNodeIndexContract = node_index
        self._values = {}

    def collect_call_returns(
        self,
        syntax_node: ast.AST,
        reference_context: PythonReferenceContextContract,
        enclosing_class_name: str = "",
    ) -> None:
        """Responsibilities: _callable return owner traversal_."""
        current_class_name = enclosing_class_name
        match syntax_node:
            case ast.ClassDef(name=class_name):
                current_class_name = class_name
            case ast.FunctionDef() | ast.AsyncFunctionDef():
                name_resolver = reference_context.name_resolver()
                self._record_return_owner(
                    syntax_node,
                    name_resolver,
                    current_class_name,
                )
        for child in self._node_index.children(syntax_node):
            self.collect_call_returns(child, reference_context, current_class_name)

    def value(self, key: str) -> str:
        """Responsibilities: _callable output owner retrieval_."""
        return self._values.get(key, "")

    def store(self, key: str, resolved_return_type: str) -> None:
        """Responsibilities: _callable output owner storage_."""
        self._values.update({key: resolved_return_type})

    def state_cleanup(self) -> None:
        """Responsibilities: _callable output owner cleanup_."""
        self._values.clear()

    def return_state(self) -> PythonCallReturnStateContract:
        """Responsibilities: _callable output state access_."""
        return self
