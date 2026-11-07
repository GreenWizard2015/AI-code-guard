from __future__ import annotations

import ast

from implementation.ast.imports.python_sys_path_aliases import PythonSysPathAliases
from implementation.ast.imports.python_sys_path_import_aliases import (
    PythonSysPathImportAliases,
)
from implementation.ast.imports.python_sys_path_references import (
    PythonSysPathReferences,
)
from implementation.ast.protocols import (
    PythonAstNodeIndexContract,
    PythonSysPathImportAliasesContract,
    PythonSysPathStateContract,
)
from implementation.references.protocols import PythonContainerAliasesContract
from protocols import (
    PythonSysPathReferencesContract,
)


class PythonSysPathRules:
    """Responsibilities: _sys.path alias configuration_, _path mutation diagnostics_."""

    def __init__(
        self,
        container_aliases: PythonContainerAliasesContract,
        node_index: PythonAstNodeIndexContract,
    ) -> None:
        """Responsibilities: _sys.path diagnostics setup_."""
        import_aliases: PythonSysPathImportAliasesContract = PythonSysPathImportAliases(
            node_index,
        )
        aliases = PythonSysPathAliases(container_aliases, node_index, import_aliases)
        references = PythonSysPathReferences(
            aliases,
            import_aliases,
            container_aliases.container_values(),
        )
        self._aliases: PythonSysPathStateContract = aliases
        self._references: PythonSysPathReferencesContract = references

    def configure(self, tree: ast.Module) -> None:
        """Responsibilities: _sys.path alias configuration_."""
        if type(tree) is not ast.Module:
            return
        self._aliases.configure(tree)

    def path_mutation(self, node: ast.AST) -> bool:
        """Responsibilities: _sys.path mutation classification_."""
        if type(node) is ast.Call:
            return self._references.path_call(node)
        if self._references.path_alias_assignment(node):
            return False
        targets: list[ast.expr] = []
        if type(node) is ast.Assign:
            targets = node.targets
        if type(node) is ast.Delete:
            targets = node.targets
        if type(node) is ast.AnnAssign:
            targets = [node.target]
        if type(node) is ast.AugAssign:
            targets = [node.target]
        return any(self._aliases.path_target(target) for target in targets)
