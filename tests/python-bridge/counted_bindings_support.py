from __future__ import annotations

import ast
from collections.abc import Iterator, Mapping

from implementation.ast.imports.python_ast_node_index import PythonAstNodeIndex
from implementation.rules.call_analysis.testing.python_test_order_dependency import (
    PythonTestOrderDependency,
)


class CountedBindings(PythonTestOrderDependency, Mapping[str, ast.AST]):
    """Responsibilities: _binding lookup_, _iteration cost observation_, _binding count_."""

    def __init__(self, bindings: dict[str, ast.AST], tree: ast.Module) -> None:
        """Responsibilities: _binding fixture initialization_."""
        super().__init__(tree, PythonAstNodeIndex())
        self._bindings: Mapping[str, ast.AST] = bindings
        self._metrics: dict[str, int] = {"iterated_entries": 0}

    def __getitem__(self, name: str) -> ast.AST:
        """Responsibilities: _binding lookup_."""
        return self._bindings[name]

    def __iter__(self) -> Iterator[str]:
        """Responsibilities: _binding iteration count_."""
        self._metrics.update({"iterated_entries": self._metrics["iterated_entries"] + len(self._bindings)})
        return iter(self._bindings)

    def __len__(self) -> int:
        """Responsibilities: _binding count lookup_."""
        return len(self._bindings)

    def iteration_count(self) -> int:
        """Responsibilities: _binding iteration measurement_."""
        return self._metrics["iterated_entries"]

    def module_mutable_objects(self) -> Mapping[str, ast.AST]:
        """Responsibilities: _instrumented module bindings_."""
        return self
