from __future__ import annotations

import ast

from implementation.references.protocols import (
    PythonContainerValuesContract,
    PythonReferenceAliasesContract,
)


class PythonExceptionMultiplicity:
    """Responsibilities: _exception sequence detection_, _multiplicity alias tracking_."""

    def _tuple_many(self, source: ast.Tuple) -> bool:
        """Responsibilities: _tuple exception values_."""
        values: list[ast.AST] = []
        for item in source.elts:
            if type(item) is ast.Starred:
                values.extend(self._container_values.container_values(item.value))
                continue
            values.append(item)
        return len(values) > 1

    def _subscript_matches(self, source: ast.Subscript) -> bool:
        """Responsibilities: _sliced exception source_."""
        resolved = self._container_values.container_value(source)
        if not resolved.found():
            return False
        values = self._container_values.container_values(resolved.expression_node())
        return len(values) > 1

    def __init__(
        self,
        container_values: PythonContainerValuesContract,
        assignment_aliases: PythonReferenceAliasesContract,
        multiple_names: set[str],
    ) -> None:
        """Responsibilities: _exception multiplicity setup_."""
        self._container_values: PythonContainerValuesContract = container_values
        self._assignment_aliases: PythonReferenceAliasesContract = assignment_aliases
        self._multiple_names: set[str] = set(multiple_names)

    def matches(self, source: ast.AST) -> bool:
        """Responsibilities: _multiple exception source_."""
        if type(source) is ast.Subscript:
            return self._subscript_matches(source)
        if type(source) is ast.Tuple:
            return self._tuple_many(source)
        if type(source) is ast.Call:
            return len(self._container_values.container_values(source)) > 1
        if type(source) is ast.Name:
            return source.id in self._multiple_names
        return False

    def configure(self, targets: list[ast.AST], value: ast.AST) -> None:
        """Responsibilities: _exception sequence alias configuration_."""
        target_values: dict[str, ast.AST] = {}
        for target in targets:
            target_values.update(
                self._assignment_aliases.target_values(
                    target,
                    value,
                    references_only=False,
                ),
            )
        for target_name, source in target_values.items():
            self._multiple_names.discard(target_name)
            if self.matches(source):
                self._multiple_names.add(target_name)

    def names(self) -> set[str]:
        """Responsibilities: _multiple exception names_."""
        return set(self._multiple_names)

    def restore_names(self, names: set[str]) -> None:
        """Responsibilities: _exception name state restoration_."""
        self._multiple_names.clear()
        self._multiple_names.update(names)

    def aliases(self) -> PythonReferenceAliasesContract:
        """Responsibilities: _exception assignment aliases_."""
        return self._assignment_aliases
