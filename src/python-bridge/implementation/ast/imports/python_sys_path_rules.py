from __future__ import annotations

import ast

from implementation.ast.imports.python_sys_path_aliases import PythonSysPathAliases
from implementation.ast.imports.python_sys_path_references import (
    PythonSysPathReferences,
)
from implementation.ast.imports.python_sys_path_import_aliases import (
    PythonSysPathImportAliases,
)
from implementation.ast.protocols import PythonAstNodeIndexContract
from protocols import (
    PythonSysPathAliasesContract,
    PythonSysPathReferencesContract,
)
from implementation.ast.protocols import PythonSysPathImportAliasesContract
from implementation.references.protocols import PythonContainerAliasesContract


class PythonSysPathRules:
    """Responsibilities: _sys.path alias configuration_, _path mutation diagnostics_."""

    def __init__(
        self,
        container_aliases: PythonContainerAliasesContract,
        node_index: PythonAstNodeIndexContract,
    ) -> None:
        """Responsibilities: _sys.path diagnostics setup_."""
        import_aliases: PythonSysPathImportAliasesContract = (
            PythonSysPathImportAliases()
        )
        aliases = PythonSysPathAliases(container_aliases, node_index, import_aliases)
        references = PythonSysPathReferences(
            aliases, import_aliases, container_aliases.container_values
        )
        self.aliases: PythonSysPathAliasesContract = aliases
        self.references: PythonSysPathReferencesContract = references

    def configure(self, tree: ast.Module) -> None:
        """Responsibilities: _sys.path alias configuration_."""
        if type(tree) is not ast.Module:
            return
        self.aliases.configure(tree)

    def path_mutation(self, node: ast.AST) -> bool:
        """Responsibilities: _sys.path mutation classification_."""
        if type(node) is ast.Call:
            return self.references.path_call(node)
        if self.references.path_alias_assignment(node):
            return False
        targets: list[ast.AST] = []
        if type(node) in (ast.Assign, ast.Delete):
            targets = node.targets
        if type(node) in (ast.AnnAssign, ast.AugAssign):
            targets = [node.target]
        return any(self.aliases.path_target(target) for target in targets)
