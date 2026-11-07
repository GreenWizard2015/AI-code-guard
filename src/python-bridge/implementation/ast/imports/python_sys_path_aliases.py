from __future__ import annotations

import ast

from implementation.ast.imports.python_sys_path_attribute_aliases import (
    PythonSysPathAttributeAliases,
)
from implementation.ast.protocols import (
    PythonAstNodeIndexContract,
    PythonSysPathAttributeAliasesContract,
    PythonSysPathImportAliasesContract,
)
from implementation.references.aliases.python_reference_aliases import (
    PythonReferenceAliases,
    PythonReferenceAliasState,
)
from implementation.references.protocols import (
    PythonContainerAliasesContract,
    PythonContainerKeysContract,
    PythonContainerValuesContract,
    PythonReferenceAliasesContract,
)
from implementation.rules.constants import SYS_PATH_MUTATING


class PythonSysPathAliases:
    """Responsibilities: _sys.path alias tracking_, _mutator alias detection_."""

    def _assigned_path_name(self, path_alias_assignment: ast.AST) -> bool:
        """Responsibilities: _assigned path alias tracking_."""
        changed = False
        target_values = self._assigned_path_values(path_alias_assignment)
        for target, value in target_values.items():
            if self.path_target(value):
                added_alias = self._import_aliases.add_path_alias(target)
                if added_alias:
                    changed = True
        return changed

    def _assigned_path_values(self, path_assignment: ast.AST) -> dict[str, ast.AST]:
        """Responsibilities: _assigned path alias values_."""
        if type(path_assignment) is ast.Assign:
            if len(path_assignment.targets) != 1:
                return {}
            return self._reference_aliases.target_values(
                path_assignment.targets[0],
                path_assignment.value,
                references_only=False,
            )
        if type(path_assignment) is ast.AnnAssign:
            if path_assignment.value is None:
                return {}
            return self._reference_aliases.target_values(
                path_assignment.target,
                path_assignment.value,
                references_only=False,
            )
        return {}

    def _attribute_path_target(self, target: ast.Attribute) -> bool:
        """Responsibilities: _sys.path attribute target_."""
        if type(target.value) is not ast.Name:
            return False
        if not self._import_aliases.system_name(target.value.id):
            return False
        return target.attr == "path"

    def _subscript_path_target(self, target: ast.Subscript) -> bool:
        """Responsibilities: _sys.path subscript target_."""
        value = target.value
        if type(value) is ast.Name:
            return self._import_aliases.path_name(value.id)
        if type(value) is not ast.Attribute:
            return False
        if value.attr != "path":
            return False
        if type(value.value) is not ast.Name:
            return False
        return self._import_aliases.system_name(value.value.id)

    def _assigned_mutator(self, mutator_assignment: ast.AST) -> None:
        """Responsibilities: _sys.path mutator alias tracking_."""
        for target, value in self._assigned_path_values(mutator_assignment).items():
            if type(value) is not ast.Attribute:
                continue
            if not self.path_mutating(value.attr):
                continue
            if self.path_target(value.value):
                self._path_mutator_names.add(target)

    def _attribute_alias_record(
        self,
        target: ast.AST,
        value: ast.AST,
        context: ast.AST,
    ) -> None:
        """Responsibilities: _attribute alias storage_."""
        if type(target) is not ast.Attribute:
            return
        if not self.path_target(value):
            return
        self._attribute_aliases.record(target, context)

    def _collect_attribute_aliases(self, attribute_assignment: ast.AST) -> None:
        """Responsibilities: _instance path alias collection_."""
        if type(attribute_assignment) is ast.Assign:
            if len(attribute_assignment.targets) != 1:
                return
            self._attribute_alias_record(
                attribute_assignment.targets[0],
                attribute_assignment.value,
                attribute_assignment,
            )
            return
        if type(attribute_assignment) is ast.AnnAssign:
            if attribute_assignment.value is not None:
                self._attribute_alias_record(
                    attribute_assignment.target,
                    attribute_assignment.value,
                    attribute_assignment,
                )

    def _collect_path_aliases(self, nodes: list[ast.AST]) -> None:
        """Responsibilities: _transitive path alias collection_."""
        for _ in nodes:
            changed = False
            previous_attribute_count = self._attribute_aliases.key_count()
            for node in nodes:
                added_alias = self._assigned_path_name(node)
                if added_alias:
                    changed = True
                self._collect_attribute_aliases(node)
            if changed:
                continue
            if self._attribute_aliases.key_count() == previous_attribute_count:
                return

    def __init__(
        self,
        container_aliases: PythonContainerAliasesContract,
        node_index: PythonAstNodeIndexContract,
        import_aliases: PythonSysPathImportAliasesContract,
    ) -> None:
        """Responsibilities: _sys.path alias setup_."""
        self._path_mutator_names: set[str] = set()
        self._import_aliases: PythonSysPathImportAliasesContract = import_aliases
        self._attribute_aliases: PythonSysPathAttributeAliasesContract = PythonSysPathAttributeAliases(node_index)
        self._path_mutating_names: frozenset[str] = SYS_PATH_MUTATING
        self._reference_aliases: PythonReferenceAliasesContract = PythonReferenceAliases(
            PythonReferenceAliasState(),
        )
        self._container_aliases: PythonContainerAliasesContract = container_aliases
        self._container_values: PythonContainerValuesContract = self._container_aliases.container_values()
        self._container_keys: PythonContainerKeysContract = self._container_aliases.container_keys()
        self._node_index: PythonAstNodeIndexContract = node_index

    def container_keys(self) -> PythonContainerKeysContract:
        """Responsibilities: _sys.path key lookup access_."""
        return self._container_keys

    def configure(self, tree: ast.Module) -> None:
        """Responsibilities: _sys.path alias configuration_."""
        self._path_mutator_names.clear()
        self._attribute_aliases.clear()
        nodes = self._node_index.nodes(tree)
        self._import_aliases.observe_imports(tree)
        self._container_aliases.clear()
        for node in nodes:
            self._container_aliases.observe(node)
        self._collect_path_aliases(nodes)
        for node in nodes:
            self._assigned_mutator(node)

    def path_mutator_name(self, name: str) -> bool:
        """Responsibilities: _sys.path mutator membership_."""
        return name in self._path_mutator_names

    def path_mutating(self, name: str) -> bool:
        """Responsibilities: _sys.path mutation method lookup_."""
        return name in self._path_mutating_names

    def path_target(self, target: ast.AST) -> bool:
        """Responsibilities: _sys.path target analysis_."""
        if type(target) is ast.Name:
            return self._import_aliases.path_name(target.id)
        if type(target) is ast.Attribute:
            if self._attribute_path_target(target):
                return True
            return self._attribute_aliases.contains(target)
        if type(target) is ast.Subscript:
            resolved = self._container_values.container_value(target)
            if resolved.found():
                return self.path_target(resolved.expression_node())
            return self._subscript_path_target(target)
        return False
