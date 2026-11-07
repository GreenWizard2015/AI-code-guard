from __future__ import annotations

import ast
import unittest

from implementation.references.context.python_scoped_owner_state import (
    PythonScopedOwnerState,
)


class PythonScopedOwnerStateTest(unittest.TestCase):
    """Responsibilities: _lexical owner lookup_, _scope shadowing_."""

    def test_resolves_module_owner_after_empty_nested_scopes(self) -> None:
        """Responsibilities: _module owner fallback verification_."""
        tree = ast.parse("client = None")
        node = tree.body[0]
        state = PythonScopedOwnerState({}, {}, {"client": "RemoteClient"}, include_module_name=True)

        owner = state.owner_resolution(["function", "module"], "client", node)

        self.assertEqual(owner.owner_name(), "RemoteClient")

    def test_runtime_write_overrides_annotation_at_same_scope(self) -> None:
        """Responsibilities: _runtime owner precedence verification_."""
        annotation_tree = ast.parse("client: RemoteClient")
        annotation_node = annotation_tree.body[0]
        runtime_tree = ast.parse("client = None")
        runtime_node = runtime_tree.body[0]
        state = PythonScopedOwnerState({}, {}, {}, include_module_name=True)
        state.record_at_scope("function", "client", "AnnotatedClient", annotation_node)
        state.record_at_scope("function", "client", "RuntimeClient", runtime_node)

        owner = state.owner_resolution(["function", "module"], "client", runtime_node)

        self.assertEqual(owner.owner_name(), "RuntimeClient")

    def test_unknown_annotation_shadows_outer_owner(self) -> None:
        """Responsibilities: _unknown binding shadow verification_."""
        tree = ast.parse("client: object")
        node = tree.body[0]
        state = PythonScopedOwnerState({}, {}, {"client": "RemoteClient"}, include_module_name=True)
        state.record_at_scope("function", "client", "", node)

        owner = state.owner_resolution(["function", "module"], "client", node)

        self.assertEqual(owner.owner_name(), "")
