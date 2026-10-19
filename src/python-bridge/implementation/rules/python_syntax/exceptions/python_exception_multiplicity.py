from __future__ import annotations

import ast

from implementation.references.aliases.protocols import (
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
                values.extend(self.container_values.container_values(item.value))
                continue
            values.append(item)
        return len(values) > 1

    def _subscript_matches(self, source: ast.Subscript) -> bool:
        """Responsibilities: _sliced exception source_."""
        resolved = self.container_values.container_value(source)
        if not resolved.found():
            return False
        values = self.container_values.container_values(resolved.expression_node())
        return len(values) > 1

    def __init__(
        self,
        container_values: PythonContainerValuesContract,
        assignment_aliases: PythonReferenceAliasesContract,
        multiple_names: set[str],
    ) -> None:
        """Responsibilities: _exception multiplicity setup_."""
        self.container_values: PythonContainerValuesContract = container_values
        self.assignment_aliases: PythonReferenceAliasesContract = assignment_aliases
        self.multiple_names: set[str] = multiple_names

    def matches(self, source: ast.AST) -> bool:
        """Responsibilities: _multiple exception source_."""
        if type(source) is ast.Subscript:
            return self._subscript_matches(source)
        if type(source) is ast.Tuple:
            return self._tuple_many(source)
        if type(source) is ast.Call:
            return len(self.container_values.container_values(source)) > 1
        if type(source) is ast.Name:
            return source.id in self.multiple_names
        return False

    def configure(self, targets: list[ast.AST], value: ast.AST) -> None:
        """Responsibilities: _exception sequence alias configuration_."""
        target_values: dict[str, ast.AST] = {}
        for target in targets:
            target_values.update(
                self.assignment_aliases.target_values(
                    target, value, references_only=False
                )
            )
        for target, source in target_values.items():
            self.multiple_names.discard(target)
            if self.matches(source):
                self.multiple_names.add(target)

    def names(self) -> set[str]:
        """Responsibilities: _multiple exception names_."""
        return self.multiple_names

    def aliases(self) -> PythonReferenceAliasesContract:
        """Responsibilities: _exception assignment aliases_."""
        return self.assignment_aliases
