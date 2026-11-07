from __future__ import annotations

import ast
import unittest

from implementation.rules.coding_issues.states.python_field_mutation_collector import (
    PythonFieldMutationCollector,
)


class PythonObjectFieldWritesTest(unittest.TestCase):
    """Responsibilities: _object field mutation_, _target access paths_."""

    def test_allows_only_named_private_self_paths(self) -> None:
        """Responsibilities: _private state path verification_."""
        tree = ast.parse(
            "class Store:\n"
            "    def update(self) -> None:\n"
            "        self._state = 1\n"
            "        self._state.value = 2\n"
            "        self.public = 3\n"
            "        self._state[0] = 4\n",
        )
        collector = PythonFieldMutationCollector()
        issues = [issue for node in ast.walk(tree) for issue in collector.collect_mutations(node)]

        self.assertEqual(
            [(issue["kind"], issue["line"]) for issue in issues],
            [("object-field-write", 4)],
        )

    def test_reports_writes_through_temporary_values(self) -> None:
        """Responsibilities: _temporary target classification_."""
        tree = ast.parse(
            "class Store:\n"
            "    def update(self, store: object) -> None:\n"
            "        store.value = 1\n"
            "        make_store().value = 2\n",
        )
        collector = PythonFieldMutationCollector()
        issues = [issue for node in ast.walk(tree) for issue in collector.collect_mutations(node)]

        self.assertEqual([issue["line"] for issue in issues], [2, 3])
