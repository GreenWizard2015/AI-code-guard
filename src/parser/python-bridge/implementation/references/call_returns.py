from __future__ import annotations
from typing import Any


from implementation.ast.annotation_resolver import AnnotationNames
from implementation.references.reference_context import PythonReferenceContext
import ast


from implementation.references.constants import REFERENCE_GENERICS


class CallReturns:
    """Responsibilities: _collection callable output owners_, _output state reset_."""

    def _call_key(self, owner: str, function_name: str) -> str:
        """Responsibilities: _construction qualified callable output_."""
        if owner:
            return f"{owner}.{function_name}"
        return function_name

    def _store_call_return(
        self, node: ast.AST, owner: str, context: PythonReferenceContext
    ) -> None:
        """Responsibilities: _storage callable output annotation_."""
        if type(node) not in (ast.FunctionDef, ast.AsyncFunctionDef):
            return
        return_owner: Any = self.annotation_resolver.annotation_name(
            node.returns, context.aliases, REFERENCE_GENERICS
        )
        function_name: Any = node.name
        if not return_owner:
            return
        context.call_returns[self._call_key(owner, function_name)] = return_owner

    def __init__(self, annotation_resolver: AnnotationNames) -> None:
        """Responsibilities: _annotation resolver initialization_."""
        self.annotation_resolver: Any = annotation_resolver

    def collect_call_returns(
        self,
        node: ast.AST,
        context: PythonReferenceContext,
        owner: str = "",
    ) -> None:
        """Responsibilities: _AST nodes traversal_, _collection callable output_."""
        current_owner: Any = owner
        if type(node) is ast.ClassDef:
            current_owner: Any = node.name
        self._store_call_return(node, current_owner, context)
        for child in ast.iter_child_nodes(node):
            self.collect_call_returns(child, context, current_owner)

    def reset_call_returns(self, context: PythonReferenceContext) -> None:
        """Responsibilities: _callable output collection cleanup_."""
        if not context.call_returns:
            return
        context.call_returns.clear()
