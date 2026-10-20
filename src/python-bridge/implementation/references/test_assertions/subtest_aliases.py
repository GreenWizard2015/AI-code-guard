from __future__ import annotations

import ast
from dataclasses import dataclass

from implementation.ast.protocols import PythonAstNodeIndexContract
from implementation.references.protocols import PythonContainerKeysContract
from implementation.references.protocols import (
    PythonContainerAliasesContract,
    PythonReferenceAliasesContract,
)


@dataclass(frozen=True)
class PythonSubtestAliasesOptions:
    """Responsibilities: _subtest source state_, _alias resolver dependencies_."""

    tree: ast.AST
    node_index: PythonAstNodeIndexContract
    container_aliases: PythonContainerAliasesContract
    container_keys: PythonContainerKeysContract
    assignment_aliases: PythonReferenceAliasesContract


class PythonSubtestAliases:
    """Responsibilities: _subtest names_, _scope aliases_."""

    def _scope(self, node: ast.AST) -> ast.AST:
        """Responsibilities: _enclosing function scope_."""
        current = node
        while True:
            parents = self.node_index.parents(current)
            if not parents:
                return self.tree
            parent = parents[0]
            if type(parent) in (ast.FunctionDef, ast.AsyncFunctionDef):
                return parent
            current = parent

    def _target_values(self, node: ast.AST) -> dict[str, ast.AST]:
        """Responsibilities: _resolution destructured subtest aliases_."""
        if type(node) is ast.Assign:
            if len(node.targets) == 1:
                return self.assignment_aliases.target_values(
                    node.targets[0], node.value
                )
        if type(node) is ast.AnnAssign:
            if node.value is not None:
                return self.assignment_aliases.target_values(node.target, node.value)
        return {}

    def _assignments(self, scope: ast.AST, node: ast.AST) -> list[ast.AST]:
        """Responsibilities: _prior alias assignments_."""
        indexed = self._scope_assignments(scope)
        return [
            item
            for item in indexed
            if item.lineno < node.lineno
            or (item.lineno == node.lineno and item.col_offset < node.col_offset)
        ]

    def _scope_assignments(self, scope: ast.AST) -> list[ast.AST]:
        """Responsibilities: _scope assignment index_."""
        cached = self._assignment_index.get(scope)
        if cached is not None:
            return cached
        assignments: list[ast.AST] = []
        for item in ast.walk(scope):
            if type(item) not in (ast.Assign, ast.AnnAssign):
                continue
            if self._scope(item) is scope:
                assignments.append(item)
        result = sorted(assignments, key=lambda item: (item.lineno, item.col_offset))
        self._assignment_index[scope] = result
        return result

    def _resolve(self, name: str, aliases: dict[str, str]) -> str:
        """Responsibilities: _alias chain resolution_."""
        resolved = name
        seen: set[str] = set()
        while resolved in aliases:
            if resolved in seen:
                break
            seen.add(resolved)
            resolved = aliases[resolved]
        return resolved

    def _bound_getattr_subtest(self, value: ast.AST, receivers: dict[str, str]) -> bool:
        """Responsibilities: _getattr subtest classification_."""
        if type(value) is not ast.Call:
            return False
        if type(value.func) is not ast.Name:
            return False
        if value.func.id != "getattr":
            return False
        if len(value.args) < 2:
            return False
        target = value.args[0]
        if type(target) is not ast.Name:
            return False
        if self._resolve(target.id, receivers) != "self":
            return False
        return self.container_keys.static_key(value.args[1]) == "subTest"

    def _bound_subtest(self, value: ast.AST, receivers: dict[str, str]) -> bool:
        """Responsibilities: _bound subtest classification_."""
        if type(value) is ast.Attribute:
            if value.attr != "subTest":
                return False
            if type(value.value) is not ast.Name:
                return False
            return self._resolve(value.value.id, receivers) == "self"
        return self._bound_getattr_subtest(value, receivers)

    def _record_name(
        self,
        target: str,
        value: ast.Name,
        receivers: dict[str, str],
        subtests: set[str],
    ) -> None:
        """Responsibilities: _named alias recording_."""
        if value.id in subtests:
            subtests.add(target)
        else:
            if self._resolve(value.id, receivers) == "self":
                receivers[target] = value.id
            else:
                receivers.pop(target, None)
                subtests.discard(target)

    def _record_target(
        self,
        target: str,
        value: ast.AST,
        receivers: dict[str, str],
        subtests: set[str],
    ) -> None:
        """Responsibilities: _record subtest alias target_."""
        if type(value) is ast.Name:
            self._record_name(target, value, receivers, subtests)
            return
        if self._bound_subtest(value, receivers):
            subtests.add(target)
            return
        receivers.pop(target, None)
        subtests.discard(target)

    def _receiver_names(self, scope: ast.AST, node: ast.AST) -> dict[str, str]:
        """Responsibilities: _receiver alias collection_."""
        receivers = {"self": "self"}
        for assignment in self._assignments(scope, node):
            for target, value in self._target_values(assignment).items():
                if type(value) is not ast.Name:
                    continue
                if self._resolve(value.id, receivers) == "self":
                    receivers[target] = value.id
        return receivers

    def _subtest_names(self, scope: ast.AST, node: ast.AST) -> set[str]:
        """Responsibilities: _subtest alias collection_."""
        receivers = self._receiver_names(scope, node)
        subtests: set[str] = set()
        for assignment in self._assignments(scope, node):
            for target, value in self._target_values(assignment).items():
                self._record_target(target, value, receivers, subtests)
        return subtests

    def _context_subtest(
        self, context: ast.AST, scope: ast.AST, aliases: set[str]
    ) -> bool:
        """Responsibilities: _context subtest classification_."""
        if type(context) is ast.Call:
            context = context.func
        if type(context) is ast.Name:
            if context.id in aliases:
                return True
        receivers = self._receiver_names(scope, context)
        return self._bound_subtest(context, receivers)

    def __init__(self, options: PythonSubtestAliasesOptions) -> None:
        """Responsibilities: _initialization subtest aliases_."""
        self.tree: ast.AST = options.tree
        self.node_index: PythonAstNodeIndexContract = options.node_index
        self.assignment_aliases: PythonReferenceAliasesContract = (
            options.assignment_aliases
        )
        self.container_aliases: PythonContainerAliasesContract = (
            options.container_aliases
        )
        self.container_keys: PythonContainerKeysContract = options.container_keys
        self._assignment_index: dict[ast.AST, list[ast.AST]] = {}

    def aliases_for(self, node: ast.AST) -> set[str]:
        """Responsibilities: _subtest alias output_."""
        if type(node) not in (ast.With, ast.AsyncWith):
            return set()
        scope = self._scope(node)
        return self._subtest_names(scope, node)

    def matches(self, node: ast.AST) -> bool:
        """Responsibilities: _subtest context classification_."""
        if type(node) not in (ast.With, ast.AsyncWith):
            return False
        scope = self._scope(node)
        aliases = self.aliases_for(node)
        for item in node.items:
            if self._context_subtest(item.context_expr, scope, aliases):
                return True
        return False
