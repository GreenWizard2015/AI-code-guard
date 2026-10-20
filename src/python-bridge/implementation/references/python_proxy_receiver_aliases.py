from __future__ import annotations

import ast

from implementation.references.protocols import PythonProxyScopeAliasIndexContract
from implementation.references.aliases.python_proxy_scope_alias_index import (
    PythonProxyScopeAliasIndex,
)
from implementation.types import (
    PythonAstParents,
    PythonProxyAliasAssignment,
    PythonProxyAliasRecords,
)


class PythonProxyReceiverAliases:
    """Responsibilities: _lexical receiver alias indexing_, _proxy owner resolution_."""

    def _collect_scope_aliases(
        self,
        scope: ast.AST,
        parents: PythonAstParents,
    ) -> list[PythonProxyAliasAssignment]:
        """Responsibilities: _scoped receiver alias assignments_."""
        assignments: list[PythonProxyAliasAssignment] = []
        for node in ast.walk(scope):
            if type(node) is not ast.Assign:
                continue
            if node is scope:
                continue
            if self._function_scope(node, parents) is not scope:
                continue
            assignment = self._assignment_alias(node)
            target = assignment["target"]
            value = assignment["value"]
            if target:
                assignments.append((node.lineno, target, value))
        return assignments

    def _scope_alias_index(
        self,
        scope: ast.AST,
        parents: PythonAstParents,
    ) -> PythonProxyScopeAliasIndexContract:
        """Responsibilities: _scoped receiver alias index_."""
        key = id(scope)
        cached = self._scope_aliases_by_id.get(key)
        if cached is not None:
            return cached
        assignments = self._collect_scope_aliases(scope, parents)
        records: PythonProxyAliasRecords = {}
        for assignment in assignments:
            target = assignment[1]
            records.setdefault(target, []).append(assignment)
        for target_records in records.values():
            target_records.sort(key=lambda assignment: assignment[0])
        index: PythonProxyScopeAliasIndexContract = PythonProxyScopeAliasIndex(records)
        self._scope_aliases_by_id[key] = index
        return index

    def _function_scope(self, node: ast.AST, parents: PythonAstParents) -> ast.AST:
        """Responsibilities: _enclosing callable scope_."""
        current = node
        while True:
            parent_list = parents.get(id(current), [])
            if not parent_list:
                return self.tree
            for parent in parent_list:
                if type(parent) in (ast.FunctionDef, ast.AsyncFunctionDef):
                    return parent
                current = parent
                break

    def _assignment_alias(self, node: ast.AST) -> dict[str, str]:
        """Responsibilities: _receiver alias assignment_."""
        if type(node) is not ast.Assign or len(node.targets) != 1:
            return {"target": "", "value": ""}
        target = node.targets[0]
        if type(target) is not ast.Name or type(node.value) is not ast.Name:
            return {"target": "", "value": ""}
        return {"target": target.id, "value": node.value.id}

    def __init__(self, tree: ast.AST) -> None:
        """Responsibilities: _initialization receiver aliases_."""
        self.tree: ast.AST = tree
        self._parents: PythonAstParents = {}
        self._scope_aliases_by_id: dict[int, PythonProxyScopeAliasIndexContract] = {}

    def configure(self) -> PythonAstParents:
        """Responsibilities: _receiver parent indexing_."""
        if self._parents:
            return self._parents
        parents: PythonAstParents = {}
        for parent in ast.walk(self.tree):
            for child in ast.iter_child_nodes(parent):
                parents.setdefault(id(child), []).append(parent)
        self._parents.update(parents)
        return self._parents

    def valid(self, node: ast.AST, name: str) -> bool:
        """Responsibilities: _valid receiver classification_."""
        return self.owner(node, name) in {"self", "cls"}

    def lambda_receiver(self, node: ast.AST) -> bool:
        """Responsibilities: _lambda receiver validation_."""
        if type(node) is not ast.Lambda or type(node.body) is not ast.Call:
            return False
        function = node.body.func
        if type(function) is not ast.Attribute or type(function.value) is not ast.Name:
            return False
        return self.valid(node, function.value.id)

    def owner(self, node: ast.AST, name: str) -> str:
        """Responsibilities: _receiver owner resolution_."""
        parents = self.configure()
        scope = self._function_scope(node, parents)
        return self._scope_alias_index(scope, parents).resolve(name, node.lineno)
