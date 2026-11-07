from __future__ import annotations

import ast

from implementation.references.constants import REFERENCE_GENERICS, SEQUENCE_ANNOTATIONS
from implementation.references.protocols import (
    PythonAnnotatedInstanceBindingsContract,
    PythonAnnotationResolverContract,
    PythonInstanceOwnerContract,
    PythonReferenceContextContract,
)
from implementation.rules.constants import PYTHON_STATIC_METHOD_DECORATOR


class PythonAnnotatedInstanceBindings(PythonAnnotatedInstanceBindingsContract):
    """Responsibilities: _annotated bindings_, _function parameter ownership_."""

    _context: PythonReferenceContextContract
    _owner_resolver: PythonInstanceOwnerContract

    def _sequence_element(self, annotation: ast.expr) -> ast.Name:
        """Responsibilities: _sequence element type resolution_."""
        match annotation:
            case ast.Subscript(value=ast.Name(id=container_name), slice=element):
                pass
            case _:
                return ast.Name(id="", ctx=ast.Load())
        if container_name not in SEQUENCE_ANNOTATIONS:
            return ast.Name(id="", ctx=ast.Load())
        match element:
            case ast.Tuple(elts=[first, *_]):
                element = first
            case ast.Tuple():
                return ast.Name(id="", ctx=ast.Load())
        match element:
            case ast.Name():
                return element
            case _:
                return ast.Name(id="", ctx=ast.Load())

    def _store_annotated_name(
        self,
        node: ast.AnnAssign,
        element: ast.Name,
        owner: str,
        annotation_resolver: PythonAnnotationResolverContract,
    ) -> None:
        """Responsibilities: _annotated owner recording_."""
        match node.target:
            case ast.Name(id=target_name):
                pass
            case _:
                return
        container = self._owner_resolver.container_name(node.annotation)
        instance_owner = self._owner_resolver.owner(node, owner, annotation_resolver)
        if not instance_owner:
            instance_owner = container or element.id
        self._context.bindings().record_binding(
            target_name,
            instance_owner,
            "",
            node,
        )
        if container:
            self._context.bindings().record_binding(
                target_name,
                "",
                element.id,
                node,
            )

    def _store_parameter(
        self,
        argument: ast.arg,
        annotation_resolver: PythonAnnotationResolverContract,
        node: ast.AST,
    ) -> None:
        """Responsibilities: _annotated parameter ownership_."""
        annotation = argument.annotation
        if annotation is None:
            return
        container = self._owner_resolver.container_name(annotation)
        element = self._sequence_element(annotation)
        if container and element.id:
            ownership = self._context
            ownership.bindings().record_binding(argument.arg, container, element.id, node)
            return
        ownership = self._context
        owner = ownership.name_resolver().annotation_name(
            annotation_resolver,
            annotation,
            set(REFERENCE_GENERICS),
        )
        ownership.bindings().record_binding(argument.arg, owner, "", node)

    def _store_parameters(
        self,
        node: ast.AST,
        annotation_resolver: PythonAnnotationResolverContract,
    ) -> None:
        """Responsibilities: _function parameter binding collection_."""
        match node:
            case ast.FunctionDef(args=arguments) | ast.AsyncFunctionDef(args=arguments):
                pass
            case _:
                return
        parameters = [*arguments.posonlyargs, *arguments.args, *arguments.kwonlyargs]
        for argument in parameters:
            self._store_parameter(argument, annotation_resolver, node)

    def _store_receiver(self, node: ast.AST, receiver_owner: str) -> None:
        """Responsibilities: _bound method receiver ownership_."""
        if not receiver_owner:
            return
        match node:
            case ast.FunctionDef(args=arguments, decorator_list=decorator_list):
                pass
            case ast.AsyncFunctionDef(args=arguments, decorator_list=decorator_list):
                pass
            case _:
                return
        decorators = set()
        for decorator in decorator_list:
            match decorator:
                case ast.Name(id=name):
                    decorators.add(name)
        if PYTHON_STATIC_METHOD_DECORATOR in decorators:
            return
        receiver_arguments = [*arguments.posonlyargs, *arguments.args]
        if receiver_arguments:
            self._context.bindings().record_binding(
                receiver_arguments[0].arg,
                receiver_owner,
                "",
                node,
            )

    def __init__(
        self,
        context: PythonReferenceContextContract,
        owner_resolver: PythonInstanceOwnerContract,
    ) -> None:
        """Responsibilities: _annotated binding state_."""
        self._context: PythonReferenceContextContract = context
        self._owner_resolver: PythonInstanceOwnerContract = owner_resolver

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
        match node.target:
            case ast.Name():
                self._store_annotated_name(node, element, owner, annotation_resolver)
                return
            case ast.Attribute(attr=attribute_name) if owner:
                pass
            case _:
                return
        ownership = self._context
        property_name = f"{owner}.{attribute_name}"
        ownership.properties().record_type(property_name, element.id, node)
        ownership.properties().record_elements(
            property_name,
            ownership.name_resolver().alias_target(element.id),
            node,
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
