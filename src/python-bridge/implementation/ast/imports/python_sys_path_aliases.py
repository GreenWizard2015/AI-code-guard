from __future__ import annotations

import ast

from implementation.references.protocols import (
    PythonContainerAliasesContract,
    PythonContainerKeysContract,
    PythonContainerValuesContract,
)
from implementation.references.aliases.python_reference_aliases import (
    PythonReferenceAliases,
)
from implementation.ast.imports.python_sys_path_attribute_aliases import (
    PythonSysPathAttributeAliases,
)
from implementation.ast.protocols import PythonSysPathImportAliasesContract
from implementation.ast.protocols import PythonAstNodeIndexContract
from implementation.rules.constants import SYS_PATH_MUTATING


class PythonSysPathAliases:
    """Responsibilities: _sys.path alias tracking_, _mutator alias detection_."""

    def _assigned_path_name(self, node: ast.AST) -> bool:
        """Responsibilities: _assigned path alias tracking_."""
        changed = False
        target_values = self._assigned_path_values(node)
        for target, value in target_values.items():
            if self.path_target(value):
                added_alias = self.import_aliases.add_path_alias(target)
                if added_alias:
                    changed = True
        return changed

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
        if not self.import_aliases.system_name(target.value.id):
            return False
        return target.attr == "path"

    def _subscript_path_target(self, target: ast.Subscript) -> bool:
        """Responsibilities: _sys.path subscript target_."""
        value = target.value
        if type(value) is ast.Name:
            return self.import_aliases.path_name(value.id)
        if type(value) is not ast.Attribute:
            return False
        if value.attr != "path":
            return False
        if type(value.value) is not ast.Name:
            return False
        return self.import_aliases.system_name(value.value.id)

    def _assigned_mutator(self, node: ast.AST) -> None:
        """Responsibilities: _sys.path mutator alias tracking_."""
        for target, value in self._assigned_path_values(node).items():
            if type(value) is not ast.Attribute:
                continue
            if value.attr not in self.path_mutating:
                continue
            if self.path_target(value.value):
                self.path_mutator_names.add(target)

    def _attribute_alias_record(
        self, target: ast.AST, value: ast.AST, context: ast.AST
    ) -> None:
        """Responsibilities: _attribute alias storage_."""
        if type(target) is not ast.Attribute:
            return
        if not self.path_target(value):
            return
        self.attribute_aliases.record(target, context)

    def _collect_attribute_aliases(self, node: ast.AST) -> None:
        """Responsibilities: _instance path alias collection_."""
        if type(node) is ast.Assign:
            if len(node.targets) != 1:
                return
            self._attribute_alias_record(node.targets[0], node.value, node)
            return
        if type(node) is ast.AnnAssign:
            if node.value is not None:
                self._attribute_alias_record(node.target, node.value, node)

    def _import_alias_collection(self, nodes: list[ast.AST]) -> None:
        """Responsibilities: _sys path import aliases_."""
        self.import_aliases.observe_imports(nodes)
        for node in nodes:
            self.container_aliases.observe(node)

    def _collect_path_aliases(self, nodes: list[ast.AST]) -> None:
        """Responsibilities: _transitive path alias collection_."""
        for _ in nodes:
            changed = False
            previous_attribute_count = len(self.attribute_aliases.keys)
            for node in nodes:
                added_alias = self._assigned_path_name(node)
                if added_alias:
                    changed = True
                self._collect_attribute_aliases(node)
            if (
                not changed
                and len(self.attribute_aliases.keys) == previous_attribute_count
            ):
                return

    def __init__(
        self,
        container_aliases: PythonContainerAliasesContract,
        node_index: PythonAstNodeIndexContract,
        import_aliases: PythonSysPathImportAliasesContract,
    ) -> None:
        """Responsibilities: _sys.path alias setup_."""
        self.path_mutator_names: set[str] = set()
        self.import_aliases: PythonSysPathImportAliasesContract = import_aliases
        self.attribute_aliases: PythonSysPathAttributeAliases = (
            PythonSysPathAttributeAliases(node_index)
        )
        self.path_mutating: frozenset[str] = SYS_PATH_MUTATING
        self.reference_aliases: PythonReferenceAliases = PythonReferenceAliases()
        self.container_aliases: PythonContainerAliasesContract = container_aliases
        self.container_values: PythonContainerValuesContract = (
            self.container_aliases.container_values
        )
        self.container_keys: PythonContainerKeysContract = (
            self.container_aliases.container_keys
        )
        self.node_index: PythonAstNodeIndexContract = node_index

    def configure(self, tree: ast.Module) -> None:
        """Responsibilities: _sys.path alias configuration_."""
        self.path_mutator_names.clear()
        self.attribute_aliases.keys.clear()
        self.container_aliases.clear()
        nodes = self.node_index.nodes(tree)
        self._import_alias_collection(nodes)
        self._collect_path_aliases(nodes)
        for node in nodes:
            self._assigned_mutator(node)

    def path_mutator_name(self, name: str) -> bool:
        """Responsibilities: _sys.path mutator membership_."""
        return name in self.path_mutator_names

    def path_target(self, target: ast.AST) -> bool:
        """Responsibilities: _sys.path target analysis_."""
        if type(target) is ast.Name:
            return self.import_aliases.path_name(target.id)
        if type(target) is ast.Attribute:
            if self._attribute_path_target(target):
                return True
            return self.attribute_aliases.contains(target)
        if type(target) is ast.Subscript:
            resolved = self.container_values.container_value(target)
            if resolved.found():
                return self.path_target(resolved.expression_node())
            return self._subscript_path_target(target)
        return False
