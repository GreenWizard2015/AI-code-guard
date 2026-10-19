from __future__ import annotations

import ast
from typing import Any

from implementation.references.constants import REFERENCE_GENERICS, SEQUENCE_ANNOTATIONS
from implementation.references.instances.python_assignment_effects import (
    PythonAssignmentEffects,
)
from implementation.references.protocols import (
    PythonAnnotationResolverContract,
    PythonReferenceContextContract,
)


class PythonInstanceOwner:
    """Responsibilities: _assignment owner resolution_, _container annotation resolution_."""

    context: PythonReferenceContextContract

    def _assignment_owner(self, value: ast.AST, node: ast.AST, owner: str) -> str:
        """Responsibilities: _assigned value owner resolution_."""
        if type(value) is ast.Call:
            return (
                self.context.reference_ownership()
                .name_resolver()
                .call_return_owner(value.func, node, True)
            )
        if type(value) is ast.Name:
            return self.context.reference_ownership().instance_owner(value.id, value)
        if type(value) is ast.Attribute:
            attribute_owner: Any = self.context.attribute_owner(value, owner)
            if attribute_owner:
                return attribute_owner
        return ""

    def __init__(self, context: PythonReferenceContextContract) -> None:
        """Responsibilities: _owner resolution context_."""
        self.context: PythonReferenceContextContract = context

    def container_name(self, annotation: ast.expr) -> str:
        """Responsibilities: _collection receiver type extraction_."""
        if (
            type(annotation) is not ast.Subscript
            or type(annotation.value) is not ast.Name
        ):
            return ""
        if annotation.value.id not in SEQUENCE_ANNOTATIONS:
            return ""
        return annotation.value.id

    def owner(
        self,
        node: ast.AST,
        owner: str,
        annotation_resolver: PythonAnnotationResolverContract,
    ) -> str:
        """Responsibilities: _assigned instance owner_."""
        effects = PythonAssignmentEffects(node)
        value = effects.assigned_value()
        annotation: Any = effects.declared_annotation()
        value_owner = ""
        if value is not None:
            value_owner = self._assignment_owner(value, node, owner)
        if value_owner:
            return value_owner
        container = self.container_name(annotation)
        if container:
            return container
        return (
            self.context.reference_ownership()
            .name_resolver()
            .annotation_name(annotation_resolver, annotation, REFERENCE_GENERICS)
        )
