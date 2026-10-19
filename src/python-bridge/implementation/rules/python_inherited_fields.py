from __future__ import annotations

import ast

InheritanceEdges = dict[str, list[str]]


class PythonInheritedFields:
    """Responsibilities: _inheritance cycle detection_, _field resolution caching_."""

    def _append_cycle_member(self, name: str) -> None:
        """Responsibilities: _inheritance cycle member collection_."""
        if name in self.visiting:
            cycle_start = self.visiting.index(name)
            self.cycle_names.update(self.visiting[cycle_start:])
            return
        if name in self.visited:
            return
        self.visiting.append(name)
        for base_name in self.edges.get(name, []):
            self._append_cycle_member(base_name)
        self.visiting.pop()
        self.visited.add(name)

    def _prepare_cycles(self) -> None:
        """Responsibilities: _inheritance cycle preparation_."""
        self.edges.update(
            {
                name: [base.id for base in node.bases if type(base) is ast.Name]
                for name, node in self.classes.items()
            }
        )
        for name in self.classes:
            self._append_cycle_member(name)

    def _base_fields(self, current: ast.ClassDef, seen: set[str]) -> dict:
        """Responsibilities: _base field collection_."""
        result: dict = {}
        for base in current.bases:
            if type(base) is ast.Name:
                result.update(self._inherited_fields(base.id, seen))
        return result

    def _inherited_fields(self, name: str, seen: set[str]) -> dict:
        """Responsibilities: _recursive inherited-field resolution_."""
        if name in seen:
            return {}
        if name not in self.cycle_names and name in self.memo:
            return dict(self.memo[name])
        current = self.classes.get(name)
        if current is None:
            return {}
        next_seen = set(seen)
        next_seen.add(name)
        result = self._base_fields(current, next_seen)
        result.update(self.own_fields.get(name, {}))
        if name not in self.cycle_names:
            self.memo[name] = dict(result)
        return result

    def __init__(
        self, classes: dict[str, ast.ClassDef], own_fields: dict[str, dict]
    ) -> None:
        """Responsibilities: _inherited-field collection initialization_."""
        self.classes: dict[str, ast.ClassDef] = classes
        self.own_fields: dict[str, dict] = own_fields
        self.edges: InheritanceEdges = {}
        self.visiting: list[str] = []
        self.visited: set[str] = set()
        self.cycle_names: set[str] = set()
        self.memo: dict[str, dict] = {}

    def class_fields(self, name: str) -> dict:
        """Responsibilities: _inherited field collection_."""
        return self._inherited_fields(name, set())

    def fields(self) -> dict:
        """Responsibilities: _all inherited class-field resolution_."""
        self._prepare_cycles()
        return {name: self.class_fields(name) for name in self.classes}
