from __future__ import annotations

import ast

from implementation.rules.sys_path_rules.sys_path_aliases import PythonSysPathAliases
from implementation.rules.sys_path_rules.sys_path_references import PythonSysPathReferences


class PythonSysPathRules:
    """Responsibilities: _sys.path mutation diagnostics_."""

    def __init__(self) -> None:
        """Responsibilities: _sys.path diagnostics setup_."""
        self.aliases: PythonSysPathAliases = PythonSysPathAliases()
        self.references: PythonSysPathReferences = PythonSysPathReferences(self.aliases)

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
