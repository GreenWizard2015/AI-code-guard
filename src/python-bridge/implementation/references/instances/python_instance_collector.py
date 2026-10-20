from __future__ import annotations

import ast

from implementation.references.instances.python_instance_bindings import (
    PythonInstanceBindings,
)
from implementation.references.protocols import (
    PythonAnnotationResolverContract,
    PythonReferenceContextContract,
)
from implementation.ast.protocols import PythonAstNodeIndexContract


class PythonInstanceCollector:
    """Responsibilities: _annotated instance collection_, _for-alias collection_."""

    def _collect_instances(
        self,
        current: ast.AST,
        owner: str,
        annotation_resolver: PythonAnnotationResolverContract,
        receiver_owner: str = "",
    ) -> None:
        """Responsibilities: _node collection instance traversal_."""
        current_owner = owner
        if type(current) is ast.ClassDef:
            current_owner = current.name
        self.binding_recorder.collect(
            current, current_owner, annotation_resolver, receiver_owner
        )
        for child in self.node_index.children(current):
            child_receiver_owner = ""
            if type(current) is ast.ClassDef:
                child_receiver_owner = current_owner
            self._collect_instances(
                child, current_owner, annotation_resolver, child_receiver_owner
            )

    def _collect_for_aliases(self, current: ast.AST, owner: str) -> None:
        """Responsibilities: _collection aliases introduced inside_."""
        current_owner = owner
        if type(current) is ast.ClassDef:
            current_owner = current.name
        self.binding_recorder.record_for_alias(current, current_owner)
        for child in self.node_index.children(current):
            self._collect_for_aliases(child, current_owner)

    def __init__(
        self,
        tree: ast.Module,
        context: PythonReferenceContextContract,
        node_index: PythonAstNodeIndexContract,
    ) -> None:
        """Responsibilities: _initialization AST context node_."""
        self.tree: ast.Module = tree
        self.node_index: PythonAstNodeIndexContract = node_index
        self.binding_recorder: PythonInstanceBindings = PythonInstanceBindings(
            context, node_index
        )

    def collect_instances(
        self, annotation_resolver: PythonAnnotationResolverContract
    ) -> None:
        """Responsibilities: _collection instances module class_."""
        self._collect_instances(self.tree, "", annotation_resolver)

    def collect_for_aliases(self) -> None:
        """Responsibilities: _collection aliases known instance_."""
        self._collect_for_aliases(self.tree, "")
