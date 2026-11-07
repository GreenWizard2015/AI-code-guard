from __future__ import annotations

import ast
from dataclasses import dataclass
from typing import Any

from implementation.references.instances.python_assignment_effects import (
    PythonAssignmentEffects,
)
from implementation.references.protocols import (
    PythonAnnotatedInstanceBindingsContract,
    PythonAnnotationResolverContract,
    PythonInstanceOwnerContract,
    PythonReferenceContextContract,
)


@dataclass(frozen=True)
class PythonInstanceBindingSource:
    """Responsibilities: _source binding identity_."""

    node: ast.AST
    owner: str
    annotation_resolver: PythonAnnotationResolverContract


class PythonInstanceBindingAnalysis:
    """Responsibilities: _single binding analysis_, _instance alias ownership_."""

    def _record_name_alias(self, target: ast.Name) -> None:
        """Responsibilities: _named instance alias recording_."""
        node = self._source.node
        owner = self._source.owner
        instance_type: Any = self._owner_resolver.owner(
            node,
            owner,
            self._source.annotation_resolver,
        )
        effects = PythonAssignmentEffects(node)
        element = self._context.collection_element_owner(effects.assigned_value(), owner)
        self._context.bindings().record_binding(
            target.id,
            instance_type,
            element,
            node,
        )

    def _record_property_alias(self, target: ast.Attribute) -> None:
        """Responsibilities: _property instance alias recording_."""
        owner = self._source.owner
        if not owner:
            return
        if self._context.attribute_owner(target.value, owner) != owner:
            return
        node = self._source.node
        value_owner = self._owner_resolver.owner(
            node,
            owner,
            self._source.annotation_resolver,
        )
        self._context.properties().record(
            owner,
            target.attr,
            value_owner,
            node,
        )

    def _record_annotation_alias(self) -> None:
        """Responsibilities: _annotation-only instance binding_."""
        node = self._source.node
        if type(node) is not ast.AnnAssign:
            return
        if type(node.target) is not ast.Name:
            return
        if self._owner_resolver.container_name(node.annotation):
            return
        instance_owner = self._owner_resolver.owner(
            node,
            self._source.owner,
            self._source.annotation_resolver,
        )
        self._context.bindings().record_binding(
            node.target.id,
            instance_owner,
            "",
            node,
        )

    def _record_alias(self) -> None:
        """Responsibilities: _known instance alias recording_."""
        node = self._source.node
        effects = PythonAssignmentEffects(node)
        if type(node) is ast.AnnAssign:
            if not effects.runtime_value_present():
                self._record_annotation_alias()
                return
        for target in effects.assignment_targets():
            if type(target) is ast.Name:
                self._record_name_alias(target)
                continue
            if type(target) is ast.Attribute:
                self._record_property_alias(target)

    def __init__(
        self,
        source: PythonInstanceBindingSource,
        context: PythonReferenceContextContract,
        owner_resolver: PythonInstanceOwnerContract,
        annotated_bindings: PythonAnnotatedInstanceBindingsContract,
    ) -> None:
        """Responsibilities: _binding analysis state initialization_."""
        self._source: PythonInstanceBindingSource = source
        self._context: PythonReferenceContextContract = context
        self._owner_resolver: PythonInstanceOwnerContract = owner_resolver
        self._annotated_bindings: PythonAnnotatedInstanceBindingsContract = annotated_bindings

    def collect_annotations(self, receiver_owner: str = "") -> None:
        """Responsibilities: _annotated binding collection_."""
        node = self._source.node
        resolver = self._source.annotation_resolver
        self._annotated_bindings.collect_function_parameters(
            node,
            resolver,
            receiver_owner,
        )
        if type(node) is ast.AnnAssign:
            self._annotated_bindings.collect_annotation(
                node,
                self._source.owner,
                resolver,
            )

    def collect(self, receiver_owner: str = "") -> None:
        """Responsibilities: _single binding collection_."""
        self.collect_annotations(receiver_owner)
        self._record_alias()
