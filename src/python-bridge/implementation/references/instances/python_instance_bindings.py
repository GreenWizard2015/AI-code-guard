from __future__ import annotations

import ast
from typing import Any

from implementation.references.instances.python_annotated_instance_bindings import (
    PythonAnnotatedInstanceBindings,
)
from implementation.references.instances.python_assignment_effects import (
    PythonAssignmentEffects,
)
from implementation.references.instances.python_instance_owner import (
    PythonInstanceOwner,
)
from implementation.references.protocols import (
    PythonAnnotationResolverContract,
    PythonAnnotatedInstanceBindingsContract,
    PythonInstanceOwnerContract,
    PythonReferenceContextContract,
)
from implementation.protocols import PythonAstNodeIndexContract


class PythonInstanceBindings:
    """Responsibilities: _annotated binding collection_, _instance alias recording_."""

    owner_resolver: PythonInstanceOwnerContract
    annotated_bindings: PythonAnnotatedInstanceBindingsContract
    node_index: PythonAstNodeIndexContract

    def _record_name_alias(
        self,
        target: ast.Name,
        node: ast.AST,
        owner: str,
        annotation_resolver: PythonAnnotationResolverContract,
    ) -> None:
        """Responsibilities: _storage named instance alias_."""
        instance_type: Any = self.owner_resolver.owner(node, owner, annotation_resolver)
        effects = PythonAssignmentEffects(node)
        element = self.context.collection_element_owner(effects.assigned_value(), owner)
        self.context.reference_ownership().record_binding(
            target.id, instance_type, element, node
        )

    def _record_property_alias(
        self,
        target: ast.Attribute,
        node: ast.AST,
        owner: str,
        annotation_resolver: PythonAnnotationResolverContract,
    ) -> None:
        """Responsibilities: _storage property instance alias_."""
        if not owner:
            return
        if self.context.attribute_owner(target.value, owner) != owner:
            return
        value_owner = self.owner_resolver.owner(node, owner, annotation_resolver)
        self.context.reference_ownership()._record_property(
            owner, target.attr, value_owner, node
        )

    def _record_alias(
        self,
        node: ast.AST,
        owner: str,
        annotation_resolver: PythonAnnotationResolverContract,
    ) -> None:
        """Responsibilities: _known instance alias recording_."""
        effects = PythonAssignmentEffects(node)
        if type(node) is ast.AnnAssign:
            if not effects.runtime_value_present():
                self._record_annotation_alias(node, owner, annotation_resolver)
                return
        for target in effects.assignment_targets():
            if type(target) is ast.Name:
                self._record_name_alias(target, node, owner, annotation_resolver)
                continue
            if type(target) is ast.Attribute:
                self._record_property_alias(target, node, owner, annotation_resolver)

    def _record_annotation_alias(
        self,
        node: ast.AnnAssign,
        owner: str,
        annotation_resolver: PythonAnnotationResolverContract,
    ) -> None:
        """Responsibilities: _annotation-only instance binding_."""
        if type(node.target) is not ast.Name:
            return
        if self.owner_resolver.container_name(node.annotation):
            return
        instance_owner = self.owner_resolver.owner(node, owner, annotation_resolver)
        self.context.reference_ownership()._record_annotation(
            node.target.id, instance_owner, node
        )

    def _binding_node(self, current: ast.AST) -> ast.AST:
        """Responsibilities: _comprehension binding source location_."""
        if type(current) is not ast.comprehension:
            return current
        parents = self.node_index.parents(current)
        if parents:
            return parents[0]
        return current

    def __init__(
        self,
        context: PythonReferenceContextContract,
        node_index: PythonAstNodeIndexContract,
    ) -> None:
        """Responsibilities: _initialization binding context_."""
        self.context: PythonReferenceContextContract = context
        self.node_index: PythonAstNodeIndexContract = node_index
        self.owner_resolver: PythonInstanceOwnerContract = PythonInstanceOwner(context)
        self.annotated_bindings: PythonAnnotatedInstanceBindingsContract = (
            PythonAnnotatedInstanceBindings(
                context,
                self.owner_resolver,
            )
        )

    def record_for_alias(self, current: ast.AST, owner: str) -> None:
        """Responsibilities: _storage loop instance alias_."""
        if type(current) not in (ast.For, ast.comprehension):
            return
        if type(current.target) is not ast.Name:
            return
        iterable_owner: Any = self.context.attribute_owner(current.iter, owner)
        iterable_element: Any = self.context.collection_element_owner(
            current.iter, owner
        )
        if iterable_element:
            iterable_owner = iterable_element
        binding_node = self._binding_node(current)
        ownership = self.context.reference_ownership()
        ownership.record_binding(current.target.id, iterable_owner, "", binding_node)

    def collect(
        self,
        current: ast.AST,
        owner: str,
        annotation_resolver: PythonAnnotationResolverContract,
        receiver_owner: str = "",
    ) -> None:
        """Responsibilities: _record current instance bindings_."""
        self.annotated_bindings.collect_function_parameters(
            current, annotation_resolver, receiver_owner
        )
        if type(current) is ast.AnnAssign:
            self.annotated_bindings.collect_annotation(
                current, owner, annotation_resolver
            )
        self._record_alias(current, owner, annotation_resolver)
