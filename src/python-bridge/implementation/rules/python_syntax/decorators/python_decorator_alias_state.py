from __future__ import annotations

import ast

from implementation.ast.protocols import PythonAstNodeIndexContract
from implementation.references.decorator_protocols import (
    PythonAssignedDescriptorIndexContract,
    PythonDecoratorNameContract,
)
from implementation.references.protocols import (
    PythonContainerAliasesContract,
    PythonContainerValuesContract,
    PythonReferenceAliasesContract,
)
from implementation.rules.constants import (
    PYTHON_BUILTINS_MODULE,
    PYTHON_CLASS_METHOD_DECORATOR,
    PYTHON_PROPERTY_DECORATOR,
    PYTHON_PROPERTY_DELETER_DECORATOR,
    PYTHON_PROPERTY_SETTER_DECORATOR,
    PYTHON_STATIC_METHOD_DECORATOR,
)
from implementation.rules.python_syntax.decorators.python_assigned_descriptor_index import (
    PythonAssignedDescriptorIndex,
)
from implementation.rules.python_syntax.decorators.python_decorator_name import (
    PythonDecoratorName,
)
from implementation.types import PythonDecoratorAliasGroups


class PythonDecoratorAliasState:
    """Responsibilities: _decorator aliases_, _local aliases_."""

    def _configure_import(self, imported: ast.alias) -> None:
        """Responsibilities: _imported decorator alias registration_."""
        local_name = self._decorator_names.imported_name(imported)
        if imported.name == PYTHON_STATIC_METHOD_DECORATOR:
            self._static_method_names.add(local_name)
        if imported.name == PYTHON_CLASS_METHOD_DECORATOR:
            self._class_method_names.add(local_name)
        if imported.name == PYTHON_PROPERTY_DECORATOR:
            self._property_names.add(local_name)

    def _configure_alias_set(self, names: set[str], target: str, source: str) -> None:
        """Responsibilities: _decorator alias membership_."""
        names.discard(target)
        if source in names:
            names.add(target)

    def _configure_assignment_targets(
        self,
        targets: list[ast.expr],
        value: ast.AST,
    ) -> None:
        """Responsibilities: _assigned decorator alias registration_."""
        target_values: dict[str, ast.AST] = {}
        for target in targets:
            target_values.update(
                self._assignment_aliases.target_values(
                    target,
                    value,
                    references_only=False,
                ),
            )
        for alias_name, source in target_values.items():
            decorator_name = self._decorator_names.expression_name(source)
            self._configure_aliases(alias_name, source, decorator_name)

    def _configure_aliases(self, target: str, source: ast.AST, name: str) -> None:
        """Responsibilities: _assigned decorator alias configuration_."""
        self._configure_alias_set(self._static_method_names, target, name)
        self._configure_alias_set(self._class_method_names, target, name)
        if type(source) is ast.Call and name in self._static_method_names:
            self._assigned_static_method_names.add(target)
        if type(source) is ast.Call and name in self._class_method_names:
            self._assigned_class_method_names.add(target)
        self._configure_alias_set(self._property_names, target, name)
        self._property_setter_names.discard(target)
        is_setter = type(source) is ast.Attribute and source.attr in {
            PYTHON_PROPERTY_SETTER_DECORATOR,
            PYTHON_PROPERTY_DELETER_DECORATOR,
        }
        if is_setter or name in self._property_setter_names:
            self._property_setter_names.add(target)

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
        node_index: PythonAstNodeIndexContract,
    ) -> None:
        """Responsibilities: _decorator alias state initialization_."""
        self._static_method_names: set[str] = {PYTHON_STATIC_METHOD_DECORATOR}
        self._class_method_names: set[str] = {PYTHON_CLASS_METHOD_DECORATOR}
        self._property_names: set[str] = {PYTHON_PROPERTY_DECORATOR}
        self._property_setter_names: set[str] = set()
        self._assigned_static_method_names: set[str] = set()
        self._assigned_class_method_names: set[str] = set()
        self._node_index: PythonAstNodeIndexContract = node_index
        self._assignment_aliases: PythonReferenceAliasesContract = assignment_aliases
        self._container_aliases: PythonContainerAliasesContract = container_aliases
        self._container_values: PythonContainerValuesContract = self._container_aliases.container_values()
        self._decorator_names: PythonDecoratorNameContract = PythonDecoratorName(
            self._container_values,
        )
        self._assigned_descriptors: PythonAssignedDescriptorIndexContract = PythonAssignedDescriptorIndex(
            self._static_method_names,
            self._class_method_names,
            self._decorator_names,
            self._node_index,
        )

    def aliases(self) -> PythonDecoratorAliasGroups:
        """Responsibilities: _decorator alias groups_."""
        return {
            "static": self._static_method_names.copy(),
            "class": self._class_method_names.copy(),
            "property": self._property_names.copy(),
            "setter": self._property_setter_names.copy(),
            "assigned_static": self._assigned_static_method_names.copy(),
            "assigned_class": self._assigned_class_method_names.copy(),
        }

    def container_values(self) -> PythonContainerValuesContract:
        """Responsibilities: _decorator container values_."""
        return self._container_values

    def assigned_descriptors(self) -> PythonAssignedDescriptorIndexContract:
        """Responsibilities: _assigned decorator descriptor lookup_."""
        return self._assigned_descriptors

    def observe_module(self, tree: ast.AST) -> None:
        """Responsibilities: _module decorator alias observation_."""
        if type(tree) is not ast.Module:
            return
        for module_statement in tree.body:
            self.observe(module_statement)
        for descendant in self._node_index.nodes(tree):
            self._configure_assignment(descendant)
        self._assigned_descriptors.collect(tree)

    def observe(self, node: ast.AST) -> None:
        """Responsibilities: _decorator alias observation_."""
        self._container_aliases.observe(node)
        if type(node) is ast.ImportFrom and node.module == PYTHON_BUILTINS_MODULE:
            for imported in node.names:
                self._configure_import(imported)
        self._configure_assignment(node)
