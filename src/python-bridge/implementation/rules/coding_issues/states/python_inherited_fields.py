from __future__ import annotations

import ast
from dataclasses import dataclass, field

from implementation.types import PythonAnnotatedFieldMap, PythonClassFieldMap

InheritanceEdges = dict[str, list[str]]


@dataclass
class PythonInheritedFieldResolutionState:
    """Responsibilities: _inheritance graph inputs_, _resolution traversal state_."""

    classes: dict[str, ast.ClassDef]
    own_fields: PythonClassFieldMap
    edges: InheritanceEdges = field(default_factory=dict)
    visiting: list[str] = field(default_factory=list)
    visited: set[str] = field(default_factory=set)
    cycle_names: set[str] = field(default_factory=set)
    memo: PythonClassFieldMap = field(default_factory=dict)


class PythonInheritedFields:
    """Responsibilities: _inheritance cycle detection_, _field resolution caching_."""

    def _append_cycle_member(self, candidate_class_name: str) -> None:
        """Responsibilities: _inheritance cycle member collection_."""
        state = self._state
        if candidate_class_name in state.visiting:
            cycle_start = state.visiting.index(candidate_class_name)
            state.cycle_names.update(state.visiting[cycle_start:])
            return
        if candidate_class_name in state.visited:
            return
        state.visiting.append(candidate_class_name)
        for base_name in state.edges.get(candidate_class_name, []):
            self._append_cycle_member(base_name)
        state.visiting.pop()
        state.visited.add(candidate_class_name)

    def _prepare_cycles(self) -> None:
        """Responsibilities: _inheritance cycle preparation_."""
        state = self._state
        state.edges.update(
            {name: [base.id for base in node.bases if type(base) is ast.Name] for name, node in state.classes.items()},
        )
        for name in state.classes:
            self._append_cycle_member(name)

    def _base_fields(
        self,
        current: ast.ClassDef,
        seen: set[str],
    ) -> PythonAnnotatedFieldMap:
        """Responsibilities: _base field collection_."""
        result: PythonAnnotatedFieldMap = {}
        for base in current.bases:
            if type(base) is ast.Name:
                result.update(self._inherited_fields(base.id, seen))
        return result

    def _inherited_fields(
        self,
        inherited_class_name: str,
        seen: set[str],
    ) -> PythonAnnotatedFieldMap:
        """Responsibilities: _recursive inherited-field resolution_."""
        state = self._state
        if inherited_class_name in seen or inherited_class_name not in state.classes:
            return {}
        if inherited_class_name not in state.cycle_names and inherited_class_name in state.memo:
            return dict(state.memo[inherited_class_name])
        current = state.classes[inherited_class_name]
        next_seen = set(seen)
        next_seen.add(inherited_class_name)
        result = self._base_fields(current, next_seen)
        result.update(state.own_fields.get(inherited_class_name, {}))
        if inherited_class_name not in state.cycle_names:
            state.memo.update({inherited_class_name: dict(result)})
        return result

    def __init__(
        self,
        classes: dict[str, ast.ClassDef],
        own_fields: PythonClassFieldMap,
    ) -> None:
        """Responsibilities: _inherited-field collection initialization_."""
        self._state: PythonInheritedFieldResolutionState = PythonInheritedFieldResolutionState(classes, own_fields)

    def class_fields(self, requested_class_name: str) -> PythonAnnotatedFieldMap:
        """Responsibilities: _inherited field collection_."""
        return self._inherited_fields(requested_class_name, set())

    def fields(self) -> PythonClassFieldMap:
        """Responsibilities: _all inherited class-field resolution_."""
        self._prepare_cycles()
        return {name: self.class_fields(name) for name in self._state.classes}
