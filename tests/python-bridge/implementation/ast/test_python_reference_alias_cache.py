import unittest
from unittest.mock import patch

from implementation.ast.python_ast_tree import PythonAstTree
from implementation.references.aliases.python_reference_aliases import PythonReferenceAliases


class PythonReferenceAliasCacheTest(unittest.TestCase):
    """Responsibilities: _cross-consumer alias reuse_, _per-source alias ownership_."""

    """Responsibilities: _Python reference alias cache_."""

    def test_reuses_module_aliases_between_ast_consumers(self) -> None:
        """Responsibilities: _module alias reuse_."""
        tree = PythonAstTree("import builtins as native\ncallback = native.getattr\n")
        original = PythonReferenceAliases._collect_assignment_alias
        with patch.object(
            PythonReferenceAliases, "_collect_assignment_alias", autospec=True, side_effect=original
        ) as collection:
            tree.content_collector.structure()
            aliases = tree.reference_aliases.collect(tree.tree)
            visits = collection.call_count

        self.assertEqual(
            {"visits": visits, "aliases": aliases},
            {
                "visits": len(tree.node_index.nodes(tree.tree)),
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

