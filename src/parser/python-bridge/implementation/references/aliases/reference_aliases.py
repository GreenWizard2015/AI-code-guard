from __future__ import annotations


import ast
from implementation.types import JsonObject


class PythonReferenceAliases:
    """Responsibilities: _source reference alias collection_."""

    def _resolve(self, name: str) -> str:
        """Responsibilities: _alias target resolution_."""
        resolved = name
        seen: set[str] = set()
        while resolved not in seen:
            seen.add(resolved)
            changed = False
            for alias in self.aliases:
                if alias["name"] != resolved:
                    continue
                resolved = str(alias["target"])
                changed = True
                break
            if not changed:
                return resolved
        return resolved

    def _collect_import_aliases(self, node: ast.AST) -> None:
        """Responsibilities: _collection imported reference aliases_."""
        if type(node) not in (ast.Import, ast.ImportFrom):
            return
        for item in node.names:
            if item.asname:
                self.aliases.append({"name": item.asname, "target": item.name})

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
        self._assignment_cache: dict[tuple[int, int], dict[str, ast.AST]] = {}

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
        for node in ast.walk(tree):
            self._collect_import_aliases(node)
            self._collect_assignment_alias(node)
        return self.aliases

    def target_ends_with(self, name: str, suffix: str) -> bool:
        """Responsibilities: _alias target suffix_."""
        return self._resolve(name).endswith(suffix)

    def target_starts_upper(self, name: str) -> bool:
        """Responsibilities: _uppercase alias target_."""
        return self._resolve(name)[:1].isupper()

    def resolved_name(self, name: str, names: frozenset[str]) -> str:
        """Responsibilities: _known alias target_."""
        resolved = self._resolve(name)
        if not names:
            return resolved
        if resolved in names:
            return resolved
        return ""
