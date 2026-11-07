import unittest

from implementation.ast.python_ast_tree import PythonAstTree


class PythonReferenceAliasCacheTest(unittest.TestCase):
    """Responsibilities: _cross-consumer alias reuse_, _per-source alias ownership_."""

    """Responsibilities: _Python reference alias cache_."""

    def test_shares_module_aliases_between_ast_consumers(self) -> None:
        """Responsibilities: _module alias consistency_."""
        tree = PythonAstTree("import builtins as native\ncallback = native.getattr\n")
        ast_data = tree.ast()
        tree_state = tree.analysis_state()
        source_tree = tree.tree()
        node_index = tree_state.core().source_dependencies().node_index()
        aliases = tree_state.imports().reference_aliases().collect(source_tree, node_index.nodes(source_tree))

        self.assertEqual(
            {"reported": ast_data["reference_aliases"], "aliases": aliases},
            {
                "reported": [
                    {"name": "native", "target": "builtins"},
                    {"name": "callback", "target": "native.getattr"},
                ],
                "aliases": [
                    {"name": "native", "target": "builtins"},
                    {"name": "callback", "target": "native.getattr"},
                ],
            },
        )

    def test_keeps_shared_aliases_owned_by_each_source(self) -> None:
        """Responsibilities: _source alias isolation_."""
        first = PythonAstTree("from builtins import getattr as callback\n")
        second = PythonAstTree("from builtins import setattr as callback\n")
        first_result = first.ast()
        second_result = second.ast()
        self.assertEqual(
            [first_result["reference_aliases"], second_result["reference_aliases"]],
            [[{"name": "callback", "target": "getattr"}], [{"name": "callback", "target": "setattr"}]],
        )

    def test_collects_annotated_type_alias_targets(self) -> None:
        """Responsibilities: _generic alias target resolution_."""
        tree = PythonAstTree(
            "from typing import TypeAlias as Alias\n"
            "from collections import UserList\n"
            "EntryList: Alias = UserList[str]\n",
        )
        ast_data = tree.ast()
        match ast_data["reference_aliases"]:
            case list() as aliases:
                pass
            case _:
                self.fail("expected reference alias records")

        self.assertIn(
            {"name": "EntryList", "target": "UserList[str]"},
            aliases,
        )
