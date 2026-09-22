from __future__ import annotations


from implementation.ast.annotation_resolver import AnnotationNames
from implementation.references.reference_context import PythonReferenceContext
import ast
from typing import Any, Optional

from implementation.references.constants import REFERENCE_GENERICS, SEQUENCE_ANNOTATIONS


class PythonInstanceCollector:
    """Responsibilities: _resolution annotated instances constructor_."""

    def _sequence_element(self, annotation: ast.expr) -> ast.Name:
        """Responsibilities: _resolution element name sequence_."""
        is_named_subscript = type(annotation) is ast.Subscript
        if is_named_subscript:
            is_named_subscript = type(annotation.value) is ast.Name
        if not is_named_subscript:
            return ast.Name(id="", ctx=ast.Load())
        if annotation.value.id not in SEQUENCE_ANNOTATIONS:
            return ast.Name(id="", ctx=ast.Load())
        element: Any = annotation.slice
        if type(element) is ast.Tuple:
            element: Any = element.elts[0]
        if type(element) is not ast.Name:
            return ast.Name(id="", ctx=ast.Load())
        return element

    def _store_annotated(self, node: ast.AnnAssign, owner: str) -> None:
        """Responsibilities: _storage instance creation annotated_."""
        element: Any = self._sequence_element(node.annotation)
        if not element.id:
            return
        if type(node.target) is ast.Name:
            self.context.instances[node.target.id] = element.id
            return
        if type(node.target) is ast.Attribute and owner:
            self.context.properties[f"{owner}.{node.target.attr}"] = element.id

    def _assignment_parts(self, node: ast.AST) -> dict[str, Optional[ast.AST]]:
        """Responsibilities: _normalization target value parts_."""
        if type(node) is ast.Assign:
            if len(node.targets) == 1:
                return {
                    "value": node.value,
                    "annotation": None,
                    "target": node.targets[0],
                }
            return {"value": None, "annotation": None, "target": None}
        if type(node) is ast.AnnAssign:
            return {
                "value": node.value,
                "annotation": node.annotation,
                "target": node.target,
            }
        return {"value": None, "annotation": None, "target": None}

    def _instance_owner(
        self, node: ast.AST, owner: str, annotation_resolver: AnnotationNames
    ) -> str:
        """Responsibilities: _resolution owner type represented_."""
        parts: Any = self._assignment_parts(node)
        value: Any = parts["value"]
        annotation: Any = parts["annotation"]
        if type(value) is ast.Call:
            return self.context.call_return_owner(value.func, fallback_to_name=True)
        if type(value) is ast.Name:
            return self.context.instances.get(value.id, "")
        if type(value) is ast.Attribute:
            attribute_owner: Any = self.context.attribute_owner(value, owner)
            if attribute_owner:
                return attribute_owner
        return annotation_resolver.annotation_name(
            annotation, self.context.aliases, REFERENCE_GENERICS
        )

    def _store_parameters(
        self, node: ast.AST, annotation_resolver: AnnotationNames
    ) -> None:
        """Responsibilities: _storage instance owners inferred_."""
        if type(node) not in (ast.FunctionDef, ast.AsyncFunctionDef):
            return
        arguments: Any = [
            *node.args.posonlyargs,
            *node.args.args,
            *node.args.kwonlyargs,
        ]
        for argument in arguments:
            owner: Any = annotation_resolver.annotation_name(
                argument.annotation, self.context.aliases, REFERENCE_GENERICS
            )
            if owner and argument.arg not in self.context.instances:
                self.context.instances[argument.arg] = owner

    def _record_alias(
        self, node: ast.AST, owner: str, annotation_resolver: AnnotationNames
    ) -> None:
        """Responsibilities: _known instance alias recording_."""
        target: Any = self._assignment_parts(node)["target"]
        instance_type: Any = self._instance_owner(node, owner, annotation_resolver)
        if not instance_type:
            return
        if type(target) is ast.Name:
            self.context.instances[target.id] = instance_type
            return
        if type(target) is not ast.Attribute or not owner:
            return
        property_key: Any = f"{owner}.{target.attr}"
        if property_key not in self.context.properties:
            self.context.properties[property_key] = instance_type

    def _collect_instances(
        self,
        current: ast.AST,
        owner: str,
        annotation_resolver: AnnotationNames,
    ) -> None:
        """Responsibilities: _node collection instance traversal_."""
        current_owner: Any = owner
        if type(current) is ast.ClassDef:
            current_owner: Any = current.name
        self._store_parameters(current, annotation_resolver)
        if type(current) is ast.AnnAssign:
            self._store_annotated(current, current_owner)
        self._record_alias(current, current_owner, annotation_resolver)
        for child in ast.iter_child_nodes(current):
            self._collect_instances(child, current_owner, annotation_resolver)

    def _collect_for_aliases(self, current: ast.AST, owner: str) -> None:
        """Responsibilities: _collection aliases introduced inside_."""
        current_owner: Any = owner
        if type(current) is ast.ClassDef:
            current_owner: Any = current.name
        for_target = type(current) is ast.For
        if for_target and type(current.target) is ast.Name:
            iterable_owner: Any = self.context.attribute_owner(
                current.iter, current_owner
            )
            if iterable_owner:
                self.context.instances[current.target.id] = iterable_owner
        for child in ast.iter_child_nodes(current):
            self._collect_for_aliases(child, current_owner)

    def __init__(
        self,
        tree: ast.Module,
        context: PythonReferenceContext,
    ) -> None:
        """Responsibilities: _initialization AST context node_."""
        self.tree: Any = tree
        self.context: Any = context

    def collect_instances(self, annotation_resolver: AnnotationNames) -> None:
        """Responsibilities: _collection instances module class_."""
        self._collect_instances(self.tree, "", annotation_resolver)

    def collect_for_aliases(self) -> None:
        """Responsibilities: _collection aliases known instance_."""
        self._collect_for_aliases(self.tree, "")
