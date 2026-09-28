from __future__ import annotations

import ast

from implementation.references.aliases.container_aliases import PythonContainerAliases
from implementation.references.aliases.protocols import (
    PythonContainerAliasesProtocol,
    PythonContainerValuesProtocol,
)
from implementation.references.aliases.reference_aliases import PythonReferenceAliases


class PythonDecoratorAliasState:
    """Responsibilities: _decorator alias state_."""

    def _local_name(self, imported: ast.alias) -> str:
        """Responsibilities: _imported decorator name resolution_."""
        if imported.asname is not None:
            return imported.asname
        return imported.name

    def _configure_import(self, imported: ast.alias) -> None:
        """Responsibilities: _imported decorator alias registration_."""
        local_name = self._local_name(imported)
        if imported.name == "staticmethod":
            self.static_method_names.add(local_name)
        if imported.name == "classmethod":
            self.class_method_names.add(local_name)
        if imported.name == "property":
            self.property_names.add(local_name)

    def _assignment_name(self, value: ast.AST) -> str:
        """Responsibilities: _assigned decorator name resolution_."""
        if type(value) is ast.Name:
            return value.id
        if type(value) is ast.Attribute:
            return value.attr
        if type(value) is ast.Subscript:
            resolved = self.container_aliases.values.container_value(value)
            if resolved.found():
                return self._assignment_name(resolved.expression_node())
        return ""

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
            self._configure_target(target, source, self._assignment_name(source))

    def _configure_target(self, target: str, source: ast.AST, name: str) -> None:
        """Responsibilities: _decorator target alias configuration_."""
        self._configure_alias_set(self.static_method_names, target, name)
        self._configure_alias_set(self.class_method_names, target, name)
        self._configure_alias_set(self.property_names, target, name)
        self.property_setter_names.discard(target)
        is_setter = type(source) is ast.Attribute and source.attr == "setter"
        if is_setter or name in self.property_setter_names:
            self.property_setter_names.add(target)

    def _configure_assignment(self, node: ast.AST) -> None:
        """Responsibilities: _decorator assignment alias configuration_."""
        if type(node) is ast.Assign:
            self._configure_assignment_targets(node.targets, node.value)
            return
        if type(node) is ast.AnnAssign and node.value is not None:
            self._configure_assignment_targets([node.target], node.value)

    def __init__(self) -> None:
        """Responsibilities: _decorator alias state initialization_."""
        self.static_method_names: set[str] = {"staticmethod"}
        self.class_method_names: set[str] = {"classmethod"}
        self.property_names: set[str] = {"property"}
        self.property_setter_names: set[str] = set()
        self.assignment_aliases: PythonReferenceAliases = PythonReferenceAliases()
        self.container_aliases: PythonContainerAliasesProtocol = (
            PythonContainerAliases()
        )
        self.container_values: PythonContainerValuesProtocol = (
            self.container_aliases.values
        )

    def observe_module(self, tree: ast.AST) -> None:
        """Responsibilities: _module decorator alias observation_."""
        if type(tree) is not ast.Module:
            return
        for node in tree.body:
            self.observe(node)

    def observe(self, node: ast.AST) -> None:
        """Responsibilities: _decorator alias observation_."""
        self.container_aliases.observe(node)
        if type(node) is ast.ImportFrom and node.module == "builtins":
            for imported in node.names:
                self._configure_import(imported)
        self._configure_assignment(node)
