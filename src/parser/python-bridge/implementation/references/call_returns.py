from __future__ import annotations
from typing import Any


from implementation.references.protocols import (
    PythonAnnotationResolverProtocol,
    PythonCallReturnStateProtocol,
    PythonReferenceContextProtocol,
)
from implementation.references.call_return_state import PythonCallReturnState
import ast


from implementation.references.constants import REFERENCE_GENERICS


class CallReturns:
    """Responsibilities: _collection callable output owners_, _output state reset_."""

    call_return_state: PythonCallReturnStateProtocol

    def _call_key(self, owner: str, function_name: str) -> str:
        """Responsibilities: _construction qualified callable output_."""
        if owner:
            return f"{owner}.{function_name}"
        return function_name

    def __init__(
        self,
        annotation_resolver: PythonAnnotationResolverProtocol,
        *provided_states: PythonCallReturnStateProtocol,
    ) -> None:
        """Responsibilities: _annotation resolver initialization_."""
        self.annotation_resolver: Any = annotation_resolver
        self.call_return_state: PythonCallReturnStateProtocol = next(
            iter(provided_states), PythonCallReturnState()
        )

    def store_call_return(
        self, node: ast.AST, owner: str, context: PythonReferenceContextProtocol
    ) -> None:
        """Responsibilities: _callable output annotation storage_."""
        if type(node) not in (ast.FunctionDef, ast.AsyncFunctionDef):
            return
        return_owner: Any = self.annotation_resolver.annotation_name(
            node.returns, context.annotation_aliases(), REFERENCE_GENERICS
        )
        function_name: Any = node.name
        if not return_owner:
            return
        self.call_return_state.store(self._call_key(owner, function_name), return_owner)

    def collect_call_returns(
        self,
        node: ast.AST,
        context: PythonReferenceContextProtocol,
        owner: str = "",
    ) -> None:
        """Responsibilities: _AST nodes traversal_, _collection callable output_."""
        current_owner: Any = owner
        if type(node) is ast.ClassDef:
            current_owner: Any = node.name
        self.store_call_return(node, current_owner, context)
        for child in ast.iter_child_nodes(node):
            self.collect_call_returns(child, context, current_owner)

    def return_state(self) -> PythonCallReturnStateProtocol:
        """Responsibilities: _callable return state_."""
        return self.call_return_state
