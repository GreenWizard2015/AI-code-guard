from __future__ import annotations

import ast

from implementation.references.protocols import PythonDecoratorAliasGroups
from implementation.references.protocols import (
    PythonContainerAliasesContract,
    PythonContainerValuesContract,
    PythonReferenceAliasesContract,
)
from implementation.rules.constants import (
    PYTHON_BUILTINS_MODULE,
    PYTHON_CLASS_METHOD_DECORATOR,
    PYTHON_PROPERTY_DECORATOR,
    PYTHON_PROPERTY_SETTER_DECORATOR,
    PYTHON_STATIC_METHOD_DECORATOR,
)
from implementation.rules.python_syntax.decorators.python_assigned_descriptor_index import (
    PythonAssignedDescriptorIndex,
)
from implementation.rules.python_syntax.decorators.python_decorator_name import (
    PythonDecoratorName,
)


class PythonDecoratorAliasState:
    """Responsibilities: _decorator aliases_, _local aliases_."""

    def _configure_import(self, imported: ast.alias) -> None:
        """Responsibilities: _imported decorator alias registration_."""
        local_name = self.decorator_names.imported_name(imported)
        if imported.name == PYTHON_STATIC_METHOD_DECORATOR:
            self.static_method_names.add(local_name)
        if imported.name == PYTHON_CLASS_METHOD_DECORATOR:
            self.class_method_names.add(local_name)
        if imported.name == PYTHON_PROPERTY_DECORATOR:
            self.property_names.add(local_name)

    def _configure_alias_set(self, names: set[str], target: str, source: str) -> None:
        """Responsibilities: _decorator alias membership_."""
        names.discard(target)
        if source in names:
            names.add(target)

    def _configure_assignment_targets(
        self, targets: list[ast.AST], value: ast.AST
    ) -> None:
        """Responsibilities: _assigned decorator alias registration_."""
        target_values: dict[str, ast.AST] = {}
        for target in targets:
            target_values.update(
                self.assignment_aliases.target_values(
                    target, value, references_only=False
                )
            )
        for target, source in target_values.items():
            name = self.decorator_names.expression_name(source)
            self._configure_method_aliases(target, source, name)
            self._configure_property_alias(target, source, name)

    def _configure_method_aliases(
        self, target: str, source: ast.AST, name: str
    ) -> None:
        """Responsibilities: _method decorator alias configuration_."""
        self._configure_alias_set(self.static_method_names, target, name)
        self._configure_alias_set(self.class_method_names, target, name)
        if type(source) is ast.Call and name in self.static_method_names:
            self.assigned_static_method_names.add(target)
        if type(source) is ast.Call and name in self.class_method_names:
            self.assigned_class_method_names.add(target)

    def _configure_property_alias(
        self, target: str, source: ast.AST, name: str
    ) -> None:
        """Responsibilities: _property decorator alias configuration_."""
        self._configure_alias_set(self.property_names, target, name)
        self.property_setter_names.discard(target)
        is_setter = (
            type(source) is ast.Attribute
            and source.attr == PYTHON_PROPERTY_SETTER_DECORATOR
        )
        if is_setter:
            self.property_setter_names.add(target)
            return
        if name in self.property_setter_names:
            self.property_setter_names.add(target)

    def _configure_assignment(self, node: ast.AST) -> None:
        """Responsibilities: _decorator assignment alias configuration_."""
        if type(node) is ast.Assign:
            self._configure_assignment_targets(node.targets, node.value)
            return
        if type(node) is ast.AnnAssign and node.value is not None:
            self._configure_assignment_targets([node.target], node.value)

    def __init__(
        self,
        container_aliases: PythonContainerAliasesContract,
        assignment_aliases: PythonReferenceAliasesContract,
    ) -> None:
        """Responsibilities: _decorator alias state initialization_."""
        self.static_method_names: set[str] = {PYTHON_STATIC_METHOD_DECORATOR}
        self.class_method_names: set[str] = {PYTHON_CLASS_METHOD_DECORATOR}
        self.property_names: set[str] = {PYTHON_PROPERTY_DECORATOR}
        self.property_setter_names: set[str] = set()
        self.assigned_static_method_names: set[str] = set()
        self.assigned_class_method_names: set[str] = set()
        self.assignment_aliases: PythonReferenceAliasesContract = assignment_aliases
        self.container_aliases: PythonContainerAliasesContract = container_aliases
        self._container_values: PythonContainerValuesContract = (
            self.container_aliases.container_values
        )
        self.decorator_names: PythonDecoratorName = PythonDecoratorName(
            self._container_values
        )
        self.assigned_descriptors: PythonAssignedDescriptorIndex = (
            PythonAssignedDescriptorIndex(
                self.static_method_names,
                self.class_method_names,
                self.decorator_names,
            )
        )

    def aliases(self) -> PythonDecoratorAliasGroups:
        """Responsibilities: _decorator alias groups_."""
        return {
            "static": self.static_method_names,
            "class": self.class_method_names,
            "property": self.property_names,
            "setter": self.property_setter_names,
            "assigned_static": self.assigned_static_method_names,
            "assigned_class": self.assigned_class_method_names,
        }

    def container_values(self) -> PythonContainerValuesContract:
        """Responsibilities: _decorator container values_."""
        return self._container_values

    def observe_module(self, tree: ast.AST) -> None:
        """Responsibilities: _module decorator alias observation_."""
        if type(tree) is not ast.Module:
            return
        for node in tree.body:
            self.observe(node)
        for node in ast.walk(tree):
            self._configure_assignment(node)
        self.assigned_descriptors.collect(tree)

    def observe(self, node: ast.AST) -> None:
        """Responsibilities: _decorator alias observation_."""
        self.container_aliases.observe(node)
        if type(node) is ast.ImportFrom and node.module == PYTHON_BUILTINS_MODULE:
            for imported in node.names:
                self._configure_import(imported)
        self._configure_assignment(node)
