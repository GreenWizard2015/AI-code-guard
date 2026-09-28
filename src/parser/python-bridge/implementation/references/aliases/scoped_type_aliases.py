from __future__ import annotations


import ast
from dataclasses import dataclass

from implementation.ast.protocols import PythonAstNodeIndexProtocol
from implementation.references.aliases.reference_aliases import PythonReferenceAliases


@dataclass(frozen=True)
class PythonTypeAliasRecord:
    """Responsibilities: _scoped alias data_."""

    name: str
    target: str
    scope: ast.AST
    line: int


class PythonScopedTypeAliases:
    """Responsibilities: _scoped type alias resolution_."""

    def _scope_owner(self, node: ast.AST) -> ast.AST:
        """Responsibilities: _nearest alias scope resolution_."""
        pending = list(self.node_index.parents(node))
        while pending:
            parent = pending.pop(0)
            if type(parent) in (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef):
                return parent
            pending.extend(self.node_index.parents(parent))
        return self.tree

    def _scope_chain(self, node: ast.AST) -> list[ast.AST]:
        """Responsibilities: _lexical alias scope collection_."""
        scopes: list[ast.AST] = []
        pending = list(self.node_index.parents(node))
        while pending:
            parent = pending.pop(0)
            if type(parent) in (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef):
                scopes.append(parent)
            pending.extend(self.node_index.parents(parent))
        scopes.append(self.tree)
        return scopes

    def _import_target(self, node: ast.ImportFrom, imported: ast.alias) -> str:
        """Responsibilities: _imported alias target resolution_."""
        if node.module is None:
            return imported.name
        return f"{node.module}.{imported.name}"

    def _import_aliases(self, node: ast.AST) -> list[PythonTypeAliasRecord]:
        """Responsibilities: _imported type alias collection_."""
        if type(node) is not ast.ImportFrom:
            return []
        scope = self._scope_owner(node)
        return [
            PythonTypeAliasRecord(
                imported.asname,
                self._import_target(node, imported),
                scope,
                node.lineno,
            )
            for imported in node.names
            if imported.asname is not None
        ]

    def _assignment_aliases(self, node: ast.AST) -> list[PythonTypeAliasRecord]:
        """Responsibilities: _assigned type alias collection_."""
        target_values: dict[str, ast.AST] = {}
        if type(node) is ast.Assign and len(node.targets) == 1:
            target_values = self.reference_aliases.target_values(node.targets[0], node.value)
        if type(node) is ast.AnnAssign and node.value is not None:
            target_values = self.reference_aliases.target_values(node.target, node.value)
        aliases: list[PythonTypeAliasRecord] = []
        for target, value in target_values.items():
            if type(value) not in (ast.Name, ast.Attribute):
                continue
            aliases.append(PythonTypeAliasRecord(
                target, ast.unparse(value), self._scope_owner(node), node.lineno
            ))
        return aliases

    def _scope_target(self, name: str, scope: ast.AST, line: int) -> str:
        """Responsibilities: _scoped alias target lookup_."""
        candidates = [
            alias
            for alias in self.aliases
            if alias.name == name and alias.scope is scope and alias.line <= line
        ]
        if not candidates:
            return ""
        return candidates[-1].target

    def __init__(self, tree: ast.AST, node_index: PythonAstNodeIndexProtocol) -> None:
        """Responsibilities: _initialization scoped alias source_."""
        self.tree: ast.AST = tree
        self.node_index: PythonAstNodeIndexProtocol = node_index
        self.reference_aliases: PythonReferenceAliases = PythonReferenceAliases()
        self.aliases: list[PythonTypeAliasRecord] = []

    def collect(self) -> None:
        """Responsibilities: _collection scoped aliases_."""
        self.aliases.clear()
        for node in self.node_index.nodes(self.tree):
            self.aliases.extend(self._import_aliases(node))
            self.aliases.extend(self._assignment_aliases(node))

    def resolve(self, name: str, context: ast.AST) -> str:
        """Responsibilities: _transitive scoped alias resolution_."""
        current = name
        visited: set[str] = set()
        while current not in visited:
            visited.add(current)
            target = ""
            for scope in self._scope_chain(context):
                target = self._scope_target(current, scope, context.lineno)
                if target != "":
                    break
            if target == "":
                return current
            current = target
        return current
