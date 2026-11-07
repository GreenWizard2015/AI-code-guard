from __future__ import annotations

import ast
from dataclasses import dataclass, field

from implementation.references.alias_types import (
    AssignmentAliasCache,
    TreeAliasCache,
)
from implementation.references.aliases.python_annotated_type_alias_collector import (
    PythonAnnotatedTypeAliasCollector,
)
from implementation.references.protocols import (
    PythonReferenceAliasStateContract,
)
from implementation.types import JsonObject


@dataclass
class PythonReferenceAliasState:
    """Responsibilities: _alias records_, _resolution and collection caches_."""

    aliases: list[JsonObject] = field(default_factory=list)
    alias_index: dict[str, str] = field(default_factory=dict)
    resolved_aliases: dict[str, str] = field(default_factory=dict)
    assignment_cache: AssignmentAliasCache = field(default_factory=dict)
    tree_cache: TreeAliasCache = field(default_factory=dict)


class PythonReferenceAliases:
    """Responsibilities: _source alias collection_, _reference target resolution_."""

    def _rebuild_alias_index(self) -> None:
        """Responsibilities: _ordered alias index construction_."""
        self._state.alias_index.clear()
        self._state.resolved_aliases.clear()
        for alias in self._state.aliases:
            name = str(alias["name"])
            if name not in self._state.alias_index:
                self._state.alias_index.update({name: str(alias["target"])})

    def _collect_import_aliases(self, node: ast.AST) -> None:
        """Responsibilities: _collection imported reference aliases_."""
        if type(node) is ast.Import:
            self._plain_aliases(node)
            return
        if type(node) is not ast.ImportFrom:
            return
        self._from_aliases(node)

    def _plain_aliases(self, node: ast.Import) -> None:
        """Responsibilities: _collection plain import aliases_."""
        for item in node.names:
            if item.asname:
                self._state.aliases.append({"name": item.asname, "target": item.name})

    def _from_aliases(self, node: ast.ImportFrom) -> None:
        """Responsibilities: _collection from import aliases_."""
        for item in node.names:
            if item.name == "*":
                continue
            alias_name = item.asname or item.name
            self._state.aliases.append({"name": alias_name, "target": item.name})

    def _collect_assignment_alias(self, node: ast.AST) -> None:
        """Responsibilities: _collection assigned reference aliases_."""
        target_values: dict[str, ast.AST] = {}
        if type(node) is ast.Assign and len(node.targets) == 1:
            target_values = self.target_values(node.targets[0], node.value)
        if type(node) is ast.AnnAssign and node.value is not None:
            target_values = self.target_values(node.target, node.value)
        for target, value in target_values.items():
            self._state.aliases.append({"name": target, "target": ast.unparse(value)})

    def _starred_values(
        self,
        starred_target: list[ast.expr],
        unpacked_value: list[ast.expr],
        star_index: int,
    ) -> dict[str, ast.AST]:
        """Responsibilities: _starred assignment alias expansion_."""
        remaining_targets = len(starred_target) - star_index - 1
        if len(unpacked_value) - star_index < remaining_targets:
            return {}
        value_index = len(unpacked_value) - remaining_targets
        target_items = starred_target[:star_index] + starred_target[star_index + 1 :]
        value_items = unpacked_value[:star_index] + unpacked_value[value_index:]
        target_values: dict[str, ast.AST] = {}
        for target_item, value_item in zip(target_items, value_items, strict=False):
            target_values.update(self._assignment_values(target_item, value_item))
        return target_values

    def _regular_values(
        self,
        unpack_target: list[ast.expr],
        unpack_value: list[ast.expr],
    ) -> dict[str, ast.AST]:
        """Responsibilities: _regular assignment alias expansion_."""
        if len(unpack_target) != len(unpack_value):
            return {}
        target_values: dict[str, ast.AST] = {}
        for target_item, value_item in zip(unpack_target, unpack_value, strict=False):
            target_values.update(self._assignment_values(target_item, value_item))
        return target_values

    def _unpack_elements(self, expression: ast.AST) -> list[ast.expr]:
        """Responsibilities: _unpacked assignment element extraction_."""
        match expression:
            case ast.Tuple(elts=elements) | ast.List(elts=elements):
                return elements
            case _:
                return []

    def _uncached_assignment_values(
        self,
        assignment_target: ast.AST,
        assigned_value: ast.AST,
    ) -> dict[str, ast.AST]:
        """Responsibilities: _uncached assignment alias extraction_."""
        match assignment_target:
            case ast.Name(id=name):
                return {name: assigned_value}
            case _:
                target_items = self._unpack_elements(assignment_target)
        value_items = self._unpack_elements(assigned_value)
        starred = [index for index, item in enumerate(target_items) if type(item) is ast.Starred]
        if len(starred) > 1:
            return {}
        if starred:
            return self._starred_values(target_items, value_items, starred[0])
        return self._regular_values(target_items, value_items)

    def _assignment_values(
        self,
        cached_target: ast.AST,
        cached_value: ast.AST,
    ) -> dict[str, ast.AST]:
        """Responsibilities: _cached assignment alias resolution_."""
        cache_key = (id(cached_target), id(cached_value))
        cached = self._state.assignment_cache.get(cache_key)
        if cached is None:
            cached = self._uncached_assignment_values(cached_target, cached_value)
            self._state.assignment_cache.update({cache_key: cached})
        return dict(cached)

    def _unresolved_alias_successor(
        self,
        alias: str,
        visited_aliases: set[str],
    ) -> bool:
        """Responsibilities: _alias chain continuation predicate_."""
        if alias not in self._state.alias_index:
            return False
        if alias in self._state.resolved_aliases:
            return False
        return alias not in visited_aliases

    def __init__(self, state: PythonReferenceAliasStateContract) -> None:
        """Responsibilities: _alias state ownership_."""
        self._state: PythonReferenceAliasStateContract = state

    def target_values(
        self,
        target_expression: ast.AST,
        value_expression: ast.AST,
        references_only: bool = True,
    ) -> dict[str, ast.AST]:
        """Responsibilities: _resolution reference assignment aliases_."""
        values = self._assignment_values(target_expression, value_expression)
        if not references_only:
            return values
        return {
            name: target_value
            for name, target_value in values.items()
            if type(target_value) in (ast.Name, ast.Attribute)
        }

    def collect(self, tree: ast.Module, nodes: list[ast.AST]) -> list[JsonObject]:
        """Responsibilities: _collection source reference aliases_."""
        self._state.aliases.clear()
        if tree in self._state.tree_cache:
            self._state.aliases.extend(self._state.tree_cache[tree])
            self._rebuild_alias_index()
            return self._state.aliases
        type_alias_collector = PythonAnnotatedTypeAliasCollector(self._state.aliases)
        for node in nodes:
            self._collect_import_aliases(node)
            if not type_alias_collector.append_type_alias(node):
                self._collect_assignment_alias(node)
        self._state.tree_cache.update({tree: tuple(self._state.aliases)})
        self._rebuild_alias_index()
        return self._state.aliases

    def target_name(self, name: str) -> str:
        """Responsibilities: _reference target resolution_."""
        path: list[str] = []
        visited: set[str] = set()
        terminal = name
        while self._unresolved_alias_successor(terminal, visited):
            visited.add(terminal)
            path.append(terminal)
            terminal = self._state.alias_index[terminal]
        resolved = self._state.resolved_aliases.get(terminal, terminal)
        cache_length = len(path)
        if terminal in visited:
            cache_length = path.index(terminal)
        self._state.resolved_aliases.update(
            dict.fromkeys(path[:cache_length], resolved),
        )
        return resolved

    def resolved_name(self, name: str, names: frozenset[str]) -> str:
        """Responsibilities: _known alias target_."""
        resolved = self.target_name(name)
        if not names:
            return resolved
        if resolved in names:
            return resolved
        return ""
