from __future__ import annotations

import ast

from implementation.references.aliases.reference_aliases import PythonReferenceAliases
from implementation.references.aliases.container_aliases import PythonContainerAliases
from implementation.references.aliases.protocols import PythonContainerAliasesProtocol
from implementation.references.aliases.container_keys import PythonContainerKeys
from implementation.references.aliases.container_values import PythonContainerValues
from implementation.rules.constants import SYS_PATH_MUTATING


class PythonSysPathAliases:
    """Responsibilities: _sys.path alias tracking_."""

    def _imported_system_name(self, node: ast.AST) -> None:
        """Responsibilities: _sys module alias tracking_."""
        if type(node) is not ast.Import:
            return
        for imported in node.names:
            if imported.name != "sys":
                continue
            local_name = imported.name
            if imported.asname is not None:
                local_name = imported.asname
            self.system_names.add(local_name)

    def _imported_path_name(self, node: ast.AST) -> None:
        """Responsibilities: _sys.path alias tracking_."""
        if type(node) is not ast.ImportFrom:
            return
        if node.module != "sys":
            return
        for imported in node.names:
            if imported.name != "path":
                continue
            local_name = imported.name
            if imported.asname is not None:
                local_name = imported.asname
            self.path_names.add(local_name)

    def _assigned_path_name(self, node: ast.AST) -> None:
        """Responsibilities: _assigned path alias tracking_."""
        target_values = self._assigned_path_values(node)
        for target, value in target_values.items():
            if self.path_target(value):
                self.path_names.add(target)

    def _assigned_path_values(self, node: ast.AST) -> dict[str, ast.AST]:
        """Responsibilities: _assigned path alias values_."""
        if type(node) is ast.Assign:
            if len(node.targets) != 1:
                return {}
            return self.reference_aliases.target_values(
                node.targets[0], node.value, references_only=False
            )
        if type(node) is ast.AnnAssign:
            if node.value is None:
                return {}
            return self.reference_aliases.target_values(
                node.target, node.value, references_only=False
            )
        return {}

    def _attribute_path_target(self, target: ast.Attribute) -> bool:
        """Responsibilities: _sys.path attribute target_."""
        if type(target.value) is not ast.Name:
            return False
        if not self.system_name(target.value.id):
            return False
        return target.attr == "path"

    def _subscript_path_target(self, target: ast.Subscript) -> bool:
        """Responsibilities: _sys.path subscript target_."""
        value = target.value
        if type(value) is ast.Name:
            return self.path_name(value.id)
        if type(value) is not ast.Attribute:
            return False
        if value.attr != "path":
            return False
        if type(value.value) is not ast.Name:
            return False
        return self.system_name(value.value.id)

    def __init__(self) -> None:
        """Responsibilities: _sys.path alias setup_."""
        self.system_names: set[str] = {"sys"}
        self.path_names: set[str] = set()
        self.path_mutating: frozenset[str] = SYS_PATH_MUTATING
        self.reference_aliases: PythonReferenceAliases = PythonReferenceAliases()
        self.container_aliases: PythonContainerAliasesProtocol = (
            PythonContainerAliases()
        )
        self.container_values: PythonContainerValues = self.container_aliases.values
        self.container_keys: PythonContainerKeys = PythonContainerKeys(
            self.container_aliases
        )

    def configure(self, tree: ast.Module) -> None:
        """Responsibilities: _sys.path alias configuration_."""
        self.system_names.clear()
        self.system_names.add("sys")
        self.path_names.clear()
        self.container_aliases.clear()
        for node in ast.walk(tree):
            self._imported_system_name(node)
            self._imported_path_name(node)
            self.container_aliases.observe(node)
        for node in ast.walk(tree):
            self._assigned_path_name(node)

    def system_name(self, name: str) -> bool:
        """Responsibilities: _sys alias membership_."""
        return name in self.system_names

    def path_name(self, name: str) -> bool:
        """Responsibilities: _path alias membership_."""
        return name in self.path_names

    def path_target(self, target: ast.AST) -> bool:
        """Responsibilities: _sys.path target analysis_."""
        if type(target) is ast.Name:
            return self.path_name(target.id)
        if type(target) is ast.Attribute:
            return self._attribute_path_target(target)
        if type(target) is ast.Subscript:
            resolved = self.container_values.container_value(target)
            if resolved.found():
                return self.path_target(resolved.expression_node())
            return self._subscript_path_target(target)
        return False
