from __future__ import annotations

import ast
from typing import Any

from implementation.references.constants import REFERENCE_GENERICS, SEQUENCE_ANNOTATIONS
from implementation.references.protocols import (
    PythonAnnotationResolverContract,
    PythonAnnotatedInstanceBindingsContract,
    PythonInstanceOwnerContract,
    PythonReferenceContextContract,
)
from implementation.rules.constants import PYTHON_STATIC_METHOD_DECORATOR


class PythonAnnotatedInstanceBindings(PythonAnnotatedInstanceBindingsContract):
    """Responsibilities: _annotated bindings_, _function parameter ownership_."""

    context: PythonReferenceContextContract
    owner_resolver: PythonInstanceOwnerContract

    def _sequence_element(self, annotation: ast.expr) -> ast.Name:
        """Responsibilities: _sequence element type resolution_."""
        if (
            type(annotation) is not ast.Subscript
            or type(annotation.value) is not ast.Name
        ):
            return ast.Name(id="", ctx=ast.Load())
        if annotation.value.id not in SEQUENCE_ANNOTATIONS:
            return ast.Name(id="", ctx=ast.Load())
        element = annotation.slice
        if type(element) is ast.Tuple:
            if not element.elts:
                return ast.Name(id="", ctx=ast.Load())
            element = element.elts[0]
        if type(element) is not ast.Name:
            return ast.Name(id="", ctx=ast.Load())
        return element

    def _store_annotated_name(
        self,
        node: ast.AnnAssign,
        element: ast.Name,
        owner: str,
        annotation_resolver: PythonAnnotationResolverContract,
    ) -> None:
        """Responsibilities: _annotated owner recording_."""
        container = self.owner_resolver.container_name(node.annotation)
        instance_owner = self.owner_resolver.owner(node, owner, annotation_resolver)
        if not instance_owner:
            instance_owner = container or element.id
        self.context.reference_ownership()._record_annotation(
            node.target.id, instance_owner, node
        )
        if container:
            self.context.reference_ownership()._record_element_annotation(
                node.target.id, element.id, node
            )

    def _store_parameter(
        self,
        argument: ast.arg,
        annotation_resolver: PythonAnnotationResolverContract,
        node: ast.AST,
    ) -> None:
        """Responsibilities: _annotated parameter ownership_."""
        container = self.owner_resolver.container_name(argument.annotation)
        element = self._sequence_element(argument.annotation)
        if container and element.id:
            ownership = self.context.reference_ownership()
            ownership.record_binding(argument.arg, container, element.id, node)
            return
        ownership = self.context.reference_ownership()
        owner: Any = ownership.name_resolver().annotation_name(
            annotation_resolver, argument.annotation, REFERENCE_GENERICS
        )
        ownership.record_binding(argument.arg, owner, "", node)

    def _store_parameters(
        self, node: ast.AST, annotation_resolver: PythonAnnotationResolverContract
    ) -> None:
        """Responsibilities: _function parameter binding collection_."""
        if type(node) not in (ast.FunctionDef, ast.AsyncFunctionDef):
            return
        arguments = [*node.args.posonlyargs, *node.args.args, *node.args.kwonlyargs]
        for argument in arguments:
            self._store_parameter(argument, annotation_resolver, node)

    def _store_receiver(self, node: ast.AST, receiver_owner: str) -> None:
        """Responsibilities: _bound method receiver ownership_."""
        if not receiver_owner or type(node) not in (
            ast.FunctionDef,
            ast.AsyncFunctionDef,
        ):
            return
        decorators = {item.id for item in node.decorator_list if type(item) is ast.Name}
        if PYTHON_STATIC_METHOD_DECORATOR in decorators:
            return
        arguments = [*node.args.posonlyargs, *node.args.args]
        if arguments:
            self.context.reference_ownership().record_binding(
                arguments[0].arg, receiver_owner, "", node
            )

    def __init__(
        self,
        context: PythonReferenceContextContract,
        owner_resolver: PythonInstanceOwnerContract,
    ) -> None:
        """Responsibilities: _annotated binding state_."""
        self.context: PythonReferenceContextContract = context
        self.owner_resolver: PythonInstanceOwnerContract = owner_resolver

    def collect_annotation(
        self,
        node: ast.AnnAssign,
        owner: str,
        annotation_resolver: PythonAnnotationResolverContract,
    ) -> None:
        """Responsibilities: _annotated binding recording_."""
        element = self._sequence_element(node.annotation)
        if not element.id:
            return
        if type(node.target) is ast.Name:
            self._store_annotated_name(node, element, owner, annotation_resolver)
            return
        if type(node.target) is ast.Attribute and owner:
            self.context.reference_ownership()._record_property_type(
                f"{owner}.{node.target.attr}", element.id, node
            )

    def collect_function_parameters(
        self,
        current: ast.AST,
        annotation_resolver: PythonAnnotationResolverContract,
        receiver_owner: str,
    ) -> None:
        """Responsibilities: _parameter receiver ownership_."""
        self._store_parameters(current, annotation_resolver)
        self._store_receiver(current, receiver_owner)
