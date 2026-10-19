import ast
import unittest
from unittest.mock import patch

from implementation.ast.python_ast_node_index import PythonAstNodeIndex
from implementation.ast.python_ast_tree import PythonAstTree
from implementation.references.aliases.python_reference_aliases import (
    PythonReferenceAliases,
)
from implementation.references.aliases.python_container_assembly import (
    PythonContainerAssembly,
)
from implementation.references.aliases.python_container_alias_state import (
    PythonContainerAliasState,
)
from implementation.references.aliases.python_container_keys import PythonContainerKeys
from implementation.references.aliases.python_container_values import PythonContainerValues
from implementation.references.aliases.protocols import PythonContainerAliasesContract


class PythonBridgeCollectionRuleTest(unittest.TestCase):
    """Responsibilities: _collection alias behavior_, _collection rule diagnostics_."""

    """Responsibilities: _Python AST outputs verification_."""

    def _container_alias_fixture(
        self, tree: ast.AST, index: PythonAstNodeIndex
    ) -> PythonContainerAliasesContract:
        """Responsibilities: _container alias fixture_."""
        assembly = PythonContainerAssembly(index)
        aliases = assembly.container_aliases()
        aliases.observe_all([tree, *ast.walk(tree)], tree)
        return aliases

    def test_multiple_result_shape_subscript(self) -> None:
        """Responsibilities: _subscript result shape verification_."""
        source = 'value = result["structuredContent"]\n'
        parser = PythonAstTree(source)
        issues = parser.coding_issues()
        kinds = {issue["kind"] for issue in issues}
        self.assertIn("multiple-result-shapes", kinds)

    def test_container_point_lookup_does_not_copy_the_alias_mapping(self) -> None:
        """Responsibilities: _container point lookup verification_."""
        state = PythonContainerAliasState()
        keys = PythonContainerKeys(state)
        values = PythonContainerValues(state, keys)
        tree = ast.parse("registry['target']\n")
        expression = tree.body[0].value
        state.aliases["module"]["registry"] = {
            "target": ast.Name(id="resolved", ctx=ast.Load()),
            "unused": ast.Name(id="unused", ctx=ast.Load()),
        }
        with patch.object(
            state,
            "container_alias",
            side_effect=AssertionError("point lookup copied the complete alias mapping"),
        ):
            result = values.container_value(expression)
        self.assertTrue(result.found())

    def test_builtin_property_alias(self) -> None:
        """Responsibilities: _builtin property alias verification_."""
        source = (
            "from builtins import property as prop\n"
            "\n"
            "class Service:\n"
            "    @prop\n"
            "    def value(self) -> int:\n"
            "        return 1\n"
        )
        parser = PythonAstTree(source)
        issues = parser.coding_issues()
        kinds = {issue["kind"] for issue in issues}
        self.assertIn("python-property", kinds)

    def test_collects_single_item_array_state_issue(self) -> None:
        """Responsibilities: _array state indexing verification_."""
        source = (
            "def find_service() -> list[Service]:\n"
            "    return []\n"
            "service = find_service()[0]\n"
        )
        parser = PythonAstTree(source)
        issues = parser.coding_issues()
        self.assertIn("single-item-array-state", {issue["kind"] for issue in issues})

    def test_collects_single_item_array_state_alias(self) -> None:
        """Responsibilities: _array alias state verification_."""
        source = (
            "def find_service() -> list[Service]:\n"
            "    return []\n"
            "services = find_service()\n"
            "service = services[0]\n"
            "items_alias, ignored = (find_service, None)\n"
            "candidate = items_alias()[0]\n"
        )
        parser = PythonAstTree(source)
        issues = parser.coding_issues()
        self.assertEqual(
            [
                issue["line"]
                for issue in issues
                if issue["kind"] == "single-item-array-state"
            ],
            [3, 5],
        )

    def test_indexes_alias_history_without_changing_latest_callable(self) -> None:
        """Responsibilities: _array alias history indexing_."""
        source = (
            "def find_service() -> list[Service]:\n"
            "    return []\n"
            "def find_other() -> list[Service]:\n"
            "    return []\n"
            "def read() -> None:\n"
            "    services = find_service()\n"
            "    first = services[0]\n"
            "    services = find_other()\n"
            "    second = services[0]\n"
        )
        parser = PythonAstTree(source)
        issues = parser.coding_issues()
        self.assertEqual(
            [
                issue["line"]
                for issue in issues
                if issue["kind"] == "single-item-array-state"
            ],
            [6, 8],
        )

    def test_container_aliases_reuse_scope_index_for_one_tree(self) -> None:
        """Responsibilities: _scope index reuse verification_."""
        tree = ast.parse("value = []\ndef read() -> None:\n    return None\n")
        index = PythonAstNodeIndex()
        first = self._container_alias_fixture(tree, index)
        second = self._container_alias_fixture(tree, index)
        name = ast.Name(id="value", ctx=ast.Load())
        self.assertEqual(
            first.container_values.container_values(name),
            second.container_values.container_values(name),
        )

    def test_reference_aliases_reuse_collection_for_one_tree(self) -> None:
        """Responsibilities: _reference alias cache_."""
        tree = ast.parse("import package.module as alias\n")
        aliases = PythonReferenceAliases()
        with patch(
            "implementation.references.aliases.python_reference_aliases.ast.walk",
            wraps=ast.walk,
        ) as walk:
            first = aliases.collect(tree)
            second = aliases.collect(tree)
        self.assertEqual(
            {
                "walk_calls": walk.call_count,
                "first": first,
                "second": second,
            },
            {
                "walk_calls": 1,
                "first": [{"name": "alias", "target": "package.module"}],
                "second": [{"name": "alias", "target": "package.module"}],
            },
        )
