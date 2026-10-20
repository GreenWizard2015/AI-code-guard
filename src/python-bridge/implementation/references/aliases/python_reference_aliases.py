from __future__ import annotations

import ast
from implementation.types import JsonObject
from implementation.references.aliases.python_annotated_type_alias_collector import (
    PythonAnnotatedTypeAliasCollector,
)


class PythonReferenceAliases:
    """Responsibilities: _source alias collection_, _reference target resolution_."""

    def _resolve(self, name: str) -> str:
        """Responsibilities: _alias terminal classification_."""
        path: list[str] = []
        positions: dict[str, int] = {}
        terminal = name
        while (
            terminal in self._alias_index
            and terminal not in self._resolved_aliases
            and terminal not in positions
        ):
            positions[terminal] = len(path)
            path.append(terminal)
            terminal = self._alias_index[terminal]
        cache_length = positions.get(terminal, len(path))
        terminal = self._resolved_aliases.get(terminal, terminal)
        self._resolved_aliases.update(dict.fromkeys(path[:cache_length], terminal))
        return terminal

    def _rebuild_alias_index(self) -> None:
        """Responsibilities: _ordered alias index construction_."""
        self._alias_index.clear()
        self._resolved_aliases.clear()
        for alias in self.aliases:
            name = str(alias["name"])
            if name not in self._alias_index:
                self._alias_index[name] = str(alias["target"])

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
                self.aliases.append({"name": item.asname, "target": item.name})

    def _from_aliases(self, node: ast.ImportFrom) -> None:
        """Responsibilities: _collection from import aliases_."""
        for item in node.names:
            if item.name == "*":
                continue
            alias_name = item.asname or item.name
            self.aliases.append({"name": alias_name, "target": item.name})

    def _collect_assignment_alias(self, node: ast.AST) -> None:
        """Responsibilities: _collection assigned reference aliases_."""
        target_values: dict[str, ast.AST] = {}
        if type(node) is ast.Assign and len(node.targets) == 1:
            target_values = self.target_values(node.targets[0], node.value)
        if type(node) is ast.AnnAssign and node.value is not None:
            target_values = self.target_values(node.target, node.value)
        for target, value in target_values.items():
            self.aliases.append({"name": target, "target": ast.unparse(value)})

    def _starred_values(
        self, target: ast.AST, value: ast.AST, star_index: int
    ) -> dict[str, ast.AST]:
        """Responsibilities: _starred assignment aliases_."""
        remaining_targets = len(target.elts) - star_index - 1
        if len(value.elts) - star_index < remaining_targets:
            return {}
        value_index = len(value.elts) - remaining_targets
        target_items = target.elts[:star_index] + target.elts[star_index + 1 :]
        value_items = value.elts[:star_index] + value.elts[value_index:]
        target_values: dict[str, ast.AST] = {}
        for target_item, value_item in zip(target_items, value_items):
            target_values.update(self._assignment_values(target_item, value_item))
        return target_values

    def _regular_values(self, target: ast.AST, value: ast.AST) -> dict[str, ast.AST]:
        """Responsibilities: _regular assignment aliases_."""
        if len(target.elts) != len(value.elts):
            return {}
        target_values: dict[str, ast.AST] = {}
        for target_item, value_item in zip(target.elts, value.elts):
            target_values.update(self._assignment_values(target_item, value_item))
        return target_values

    def _uncached_assignment_values(
        self, target: ast.AST, value: ast.AST
    ) -> dict[str, ast.AST]:
        """Responsibilities: _uncached assignment aliases_."""
        if type(target) is ast.Name:
            return {target.id: value}
        if type(target) not in (ast.Tuple, ast.List) or type(value) not in (
            ast.Tuple,
            ast.List,
        ):
            return {}
        starred = [
            index for index, item in enumerate(target.elts) if type(item) is ast.Starred
        ]
        if len(starred) > 1:
            return {}
        if starred:
            return self._starred_values(target, value, starred[0])
        return self._regular_values(target, value)

    def _assignment_values(self, target: ast.AST, value: ast.AST) -> dict[str, ast.AST]:
        """Responsibilities: _destructured assignment aliases_."""
        cache_key = (id(target), id(value))
        cached = self._assignment_cache.get(cache_key)
        if cached is None:
            cached = self._uncached_assignment_values(target, value)
            self._assignment_cache[cache_key] = cached
        return dict(cached)

    def __init__(self) -> None:
        """Responsibilities: _initialization reference aliases_."""
        self.aliases: list[JsonObject] = []
        self._alias_index: dict[str, str] = {}
        self._resolved_aliases: dict[str, str] = {}
        self._assignment_cache: dict[tuple[int, int], dict[str, ast.AST]] = {}
        self._tree_cache: dict[ast.Module, tuple[JsonObject, ...]] = {}

    def target_values(
        self, target: ast.AST, value: ast.AST, references_only: bool = True
    ) -> dict[str, ast.AST]:
        """Responsibilities: _resolution reference assignment aliases_."""
        values = self._assignment_values(target, value)
        if not references_only:
            return values
        return {
            name: target_value
            for name, target_value in values.items()
            if type(target_value) in (ast.Name, ast.Attribute)
        }

    def collect(self, tree: ast.Module) -> list[JsonObject]:
        """Responsibilities: _collection source reference aliases_."""
        self.aliases.clear()
        if tree in self._tree_cache:
            self.aliases.extend(self._tree_cache[tree])
            self._rebuild_alias_index()
            return self.aliases
        type_alias_collector = PythonAnnotatedTypeAliasCollector(self.aliases)
        for node in ast.walk(tree):
            self._collect_import_aliases(node)
            if not type_alias_collector.append_type_alias(node):
                self._collect_assignment_alias(node)
        self._tree_cache[tree] = tuple(self.aliases)
        self._rebuild_alias_index()
        return self.aliases

    def target_ends_with(self, name: str, suffix: str) -> bool:
        """Responsibilities: _alias target suffix_."""
        target = self._resolve(name)
        return target.endswith(suffix)

    def target_is_class(self, name: str) -> bool:
        """Responsibilities: _class reference classification_."""
        resolved_target = self._resolve(name)
        target_parts = resolved_target.rsplit(".", 1)
        target = target_parts[-1]
        return target[:1].isupper()

    def resolved_name(self, name: str, names: frozenset[str]) -> str:
        """Responsibilities: _known alias target_."""
        resolved = self._resolve(name)
        if not names:
            return resolved
        if resolved in names:
            return resolved
        return ""
