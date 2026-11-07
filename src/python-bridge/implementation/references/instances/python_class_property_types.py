from __future__ import annotations

import ast

from implementation.ast.protocols import PythonAstNodeIndexContract
from implementation.references.instances.python_assignment_effects import (
    PythonAssignmentEffects,
)
from implementation.rules.constants import (
    PYTHON_CACHED_PROPERTY_DECORATOR,
    PYTHON_INIT_METHOD,
    PYTHON_PROPERTY_DECORATOR,
)
from implementation.rules.type_rule_protocols import PythonPropertyTypeContract


class PythonClassPropertyTypes:
    """Responsibilities: _declared class property types_, _initializer property types_."""

    _class_node: ast.ClassDef
    _type_resolver: PythonPropertyTypeContract
    _node_index: PythonAstNodeIndexContract
    _properties: dict[str, str]

    def _append_property_method(
        self,
        method_name: str,
        decorators: list[ast.expr],
        annotation: ast.expr,
    ) -> None:
        """Responsibilities: _decorated property type recording_."""
        decorator_names = {self._decorator_name(item) for item in decorators}
        if not decorator_names.intersection(
            {PYTHON_PROPERTY_DECORATOR, PYTHON_CACHED_PROPERTY_DECORATOR},
        ):
            return
        type_name = self._type_resolver.annotation_type(annotation)
        if type_name:
            self._properties.update({f"{self._class_node.name}.{method_name}": type_name})

    def _append_annotation_property(self, annotation: ast.AnnAssign) -> None:
        """Responsibilities: _annotated class property recording_."""
        if type(annotation.target) is not ast.Name:
            return
        type_name = self._type_resolver.annotation_type(annotation.annotation)
        if type_name:
            self._properties.update({f"{self._class_node.name}.{annotation.target.id}": type_name})

    def _append_initializer_assignment(
        self,
        assignment: ast.AST,
        arguments: dict[str, str],
    ) -> None:
        """Responsibilities: _instance property assignment recording_."""
        effects = PythonAssignmentEffects(assignment)
        type_name = self._type_resolver.assignment_type(assignment, arguments)
        for target in effects.assignment_targets():
            if type(target) is not ast.Attribute:
                continue
            if not self._type_resolver.instance_target(target):
                continue
            if type_name:
                self._properties.update({f"{self._class_node.name}.{target.attr}": type_name})

    def _decorator_name(self, decorator: ast.expr) -> str:
        """Responsibilities: _property decorator normalization_."""
        value: ast.expr = decorator
        if type(decorator) is ast.Call:
            value = decorator.func
        if type(value) is ast.Name:
            return value.id
        if type(value) is ast.Attribute:
            return value.attr
        return ""

    def _class_items(self, item: ast.stmt) -> list[ast.stmt]:
        """Responsibilities: _conditional class member selection_."""
        if type(item) is not ast.If:
            return [item]
        if type(item.test) is ast.Name and item.test.id == "TYPE_CHECKING":
            return item.body
        return [item]

    def _collect_initializer_properties(self, initializer: ast.AST) -> dict[str, str]:
        """Responsibilities: _initializer property type collection_."""
        arguments = self._type_resolver.init_arguments(initializer)
        for assignment in self._node_index.nodes(initializer):
            self._append_initializer_assignment(assignment, arguments)
        return dict(self._properties)

    def __init__(
        self,
        class_node: ast.ClassDef,
        type_resolver: PythonPropertyTypeContract,
        node_index: PythonAstNodeIndexContract,
    ) -> None:
        """Responsibilities: _class property source ownership_."""
        self._class_node = class_node
        self._type_resolver = type_resolver
        self._node_index = node_index
        self._properties: dict[str, str] = {}

    def collect_class_members(self) -> dict[str, str]:
        """Responsibilities: _declared property collection_."""
        for item in self._class_node.body:
            for member in self._class_items(item):
                if type(member) is ast.FunctionDef and member.returns is not None:
                    self._append_property_method(
                        member.name,
                        member.decorator_list,
                        member.returns,
                    )
                if type(member) is ast.AsyncFunctionDef and member.returns is not None:
                    self._append_property_method(
                        member.name,
                        member.decorator_list,
                        member.returns,
                    )
                if type(member) is ast.AnnAssign:
                    self._append_annotation_property(member)
        return dict(self._properties)

    def collect_initializer_properties(self) -> dict[str, str]:
        """Responsibilities: _initializer property collection_."""
        for item in self._class_node.body:
            if type(item) is ast.FunctionDef and item.name == PYTHON_INIT_METHOD:
                return self._collect_initializer_properties(item)
            if type(item) is ast.AsyncFunctionDef and item.name == PYTHON_INIT_METHOD:
                return self._collect_initializer_properties(item)
        return dict(self._properties)
