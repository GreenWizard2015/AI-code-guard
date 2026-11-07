from __future__ import annotations

import ast

from implementation.ast.protocols import (
    PythonAstNodeIndexContract,
    PythonScopedTypeAliasIndexContract,
)
from implementation.references.protocols import PythonReferenceAliasesContract


class PythonScopedTypeAliasNode:
    """Responsibilities: _scoped alias declarations_, _lexical scope chain_."""

    def _scope_owner(self) -> ast.AST:
        """Responsibilities: _nearest alias scope_."""
        pending = list(self._node_index.parents(self._node))
        while pending:
            parent = pending.pop(0)
            if type(parent) in (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef):
                return parent
            pending.extend(self._node_index.parents(parent))
        return self._tree

    def _import_aliases(self) -> None:
        """Responsibilities: _imported type alias entries_."""
        if type(self._node) is not ast.ImportFrom:
            return
        for imported in self._node.names:
            if imported.asname is None:
                continue
            target = imported.name
            if self._node.module is not None:
                target = f"{self._node.module}.{target}"
            self._alias_index.add_alias(
                imported.asname,
                target,
                self._scope_owner(),
                self._node.lineno,
            )

    def _assignment_aliases(self) -> None:
        """Responsibilities: _assigned type alias entries_."""
        target_values = self._assignment_values()
        for target, value in target_values.items():
            if type(value) not in (ast.Name, ast.Attribute):
                continue
            self._alias_index.add_alias(
                target,
                ast.unparse(value),
                self._scope_owner(),
                self._node.lineno,
            )

    def _assignment_values(self) -> dict[str, ast.AST]:
        """Responsibilities: _assignment alias targets_."""
        if type(self._node) is ast.Assign and len(self._node.targets) == 1:
            return self._reference_aliases.target_values(
                self._node.targets[0],
                self._node.value,
            )
        if type(self._node) is ast.AnnAssign and self._node.value is not None:
            return self._reference_aliases.target_values(
                self._node.target,
                self._node.value,
            )
        return {}

    def __init__(
        self,
        node: ast.AST,
        alias_index: PythonScopedTypeAliasIndexContract,
        reference_aliases: PythonReferenceAliasesContract,
    ) -> None:
        """Responsibilities: _scoped alias context state_."""
        self._node: ast.AST = node
        self._tree: ast.AST = alias_index.source_tree()
        self._node_index: PythonAstNodeIndexContract = alias_index.source_node_index()
        self._reference_aliases: PythonReferenceAliasesContract = reference_aliases
        self._alias_index: PythonScopedTypeAliasIndexContract = alias_index

    def collect(self) -> None:
        """Responsibilities: _scoped alias declarations_."""
        self._import_aliases()
        self._assignment_aliases()

    def scope_chain(self) -> list[ast.AST]:
        """Responsibilities: _lexical alias scopes_."""
        scopes: list[ast.AST] = []
        pending = list(self._node_index.parents(self._node))
        while pending:
            parent = pending.pop(0)
            if type(parent) in (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef):
                scopes.append(parent)
            pending.extend(self._node_index.parents(parent))
        scopes.append(self._tree)
        return scopes
