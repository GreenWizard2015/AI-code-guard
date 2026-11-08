from __future__ import annotations

import ast
from dataclasses import dataclass
from typing import cast

from implementation.ast.callables.python_scoped_type_alias_node import (
    PythonScopedTypeAliasNode,
)
from implementation.ast.protocols import (
    PythonAstNodeIndexContract,
    PythonScopedTypeAliasIndexContract,
)
from implementation.references.aliases.python_reference_aliases import (
    PythonReferenceAliases,
    PythonReferenceAliasState,
)
from implementation.references.protocols import PythonReferenceAliasesContract
from implementation.types import PythonASTLocatedNode


@dataclass(frozen=True)
class PythonTypeAliasRecord:
    """Responsibilities: _scoped alias identity_, _source alias location_."""

    name: str
    target: str
    scope: ast.AST
    line: int


class PythonScopedTypeAliases(PythonScopedTypeAliasIndexContract):
    """Responsibilities: _lexical alias ownership_, _type alias resolution_."""

    def _scope_target(self, name: str, scope: ast.AST, line: int) -> str:
        """Responsibilities: _scoped alias target lookup_."""
        candidates = [
            alias for alias in self._aliases if alias.name == name and alias.scope is scope and alias.line <= line
        ]
        if not candidates:
            return ""
        return candidates[-1].target

    def __init__(self, tree: ast.AST, node_index: PythonAstNodeIndexContract) -> None:
        """Responsibilities: _scoped alias source state_."""
        self._tree: ast.AST = tree
        self._node_index: PythonAstNodeIndexContract = node_index
        self._aliases: list[PythonTypeAliasRecord] = []

    def source_tree(self) -> ast.AST:
        """Responsibilities: _alias source tree_."""
        return self._tree

    def source_node_index(self) -> PythonAstNodeIndexContract:
        """Responsibilities: _alias node index_."""
        return self._node_index

    def collect(self) -> None:
        """Responsibilities: _scoped aliases_."""
        self._aliases.clear()
        reference_aliases: PythonReferenceAliasesContract = PythonReferenceAliases(
            PythonReferenceAliasState(),
        )
        for node in self._node_index.nodes(self._tree):
            if type(node) not in (ast.ImportFrom, ast.Assign, ast.AnnAssign):
                continue
            alias_node = PythonScopedTypeAliasNode(node, self, reference_aliases)
            alias_node.collect()

    def add_alias(self, name: str, target: str, scope: ast.AST, line: int) -> None:
        """Responsibilities: _scoped type alias records_."""
        self._aliases.append(PythonTypeAliasRecord(name, target, scope, line))

    def resolve(self, name: str, context: ast.AST) -> str:
        """Responsibilities: _transitive scoped alias resolution_."""
        current = name
        visited: set[str] = set()
        alias_node = PythonScopedTypeAliasNode(
            context,
            self,
            PythonReferenceAliases(PythonReferenceAliasState()),
        )
        while current not in visited:
            visited.add(current)
            target = ""
            for scope in alias_node.scope_chain():
                target = self._scope_target(current, scope, cast(PythonASTLocatedNode, context).lineno)
                if target != "":
                    break
            if target == "":
                return current
            current = target
        return current
