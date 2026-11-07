from __future__ import annotations

import ast

from implementation.ast.protocols import PythonAstNodeIndexContract
from implementation.references.constants import PYTHON_INSTANCE_BINDING_NODE_TYPES
from implementation.references.instances.python_annotated_instance_bindings import (
    PythonAnnotatedInstanceBindings,
)
from implementation.references.instances.python_instance_binding_analysis import (
    PythonInstanceBindingAnalysis,
    PythonInstanceBindingSource,
)
from implementation.references.instances.python_instance_owner import (
    PythonInstanceOwner,
)
from implementation.references.protocols import (
    PythonAnnotatedInstanceBindingsContract,
    PythonAnnotationResolverContract,
    PythonInstanceOwnerContract,
    PythonReferenceContextContract,
)


class PythonInstanceBindings:
    """Responsibilities: _annotated binding collection_, _instance alias recording_."""

    _owner_resolver: PythonInstanceOwnerContract
    _annotated_bindings: PythonAnnotatedInstanceBindingsContract
    _node_index: PythonAstNodeIndexContract

    def _binding_node(self, loop_node: ast.AST) -> ast.AST:
        """Responsibilities: _loop alias binding_."""
        match loop_node:
            case ast.comprehension():
                pass
            case _:
                return loop_node
        parents = self._node_index.parents(loop_node)
        if not parents:
            return loop_node
        return parents[0]

    def _bind_loop_element(
        self,
        target_name: str,
        source_expression: ast.expr,
        enclosing_owner: str,
        binding_node: ast.AST,
    ) -> None:
        """Responsibilities: _loop element binding_."""
        element_owner = self._context.collection_element_owner(
            source_expression,
            enclosing_owner,
        )
        if not element_owner:
            element_owner = self._context.attribute_owner(
                source_expression,
                enclosing_owner,
            )
        self._context.bindings().record_binding(
            target_name,
            element_owner,
            "",
            binding_node,
        )

    def __init__(
        self,
        context: PythonReferenceContextContract,
        node_index: PythonAstNodeIndexContract,
    ) -> None:
        """Responsibilities: _initialization binding context_."""
        self._context: PythonReferenceContextContract = context
        self._node_index: PythonAstNodeIndexContract = node_index
        self._owner_resolver: PythonInstanceOwnerContract = PythonInstanceOwner(context)
        self._annotated_bindings: PythonAnnotatedInstanceBindingsContract = PythonAnnotatedInstanceBindings(
            context,
            self._owner_resolver,
        )

    def record_for_alias(self, current: ast.AST, owner: str) -> None:
        """Responsibilities: _storage loop instance alias_."""
        match current:
            case ast.For(target=target, iter=iterable) | ast.comprehension(
                target=target,
                iter=iterable,
            ):
                pass
            case _:
                return
        if type(target) is not ast.Name:
            return
        binding_node = self._binding_node(current)
        self._bind_loop_element(target.id, iterable, owner, binding_node)

    def collect(
        self,
        current: ast.AST,
        owner: str,
        annotation_resolver: PythonAnnotationResolverContract,
        receiver_owner: str = "",
    ) -> None:
        """Responsibilities: _record current instance bindings_."""
        if type(current) not in PYTHON_INSTANCE_BINDING_NODE_TYPES:
            return
        source = PythonInstanceBindingSource(current, owner, annotation_resolver)
        analysis = PythonInstanceBindingAnalysis(
            source,
            self._context,
            self._owner_resolver,
            self._annotated_bindings,
        )
        analysis.collect(receiver_owner)
