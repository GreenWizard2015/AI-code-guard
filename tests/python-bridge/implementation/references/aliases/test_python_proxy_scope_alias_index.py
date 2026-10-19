import unittest

from implementation.references.aliases.python_proxy_scope_alias_index import PythonProxyScopeAliasIndex


class PythonProxyScopeAliasIndexTest(unittest.TestCase):
    """Responsibilities: _assignment history indexing_, _line-specific alias resolution_."""

    """Responsibilities: _Python proxy alias index_."""

    def test_selects_latest_assignment_for_each_query_line(self) -> None:
        """Responsibilities: _line-specific receiver alias result_."""
        index = PythonProxyScopeAliasIndex(
            {"receiver": [(2, "receiver", "self"), (3, "receiver", "other"), (3, "receiver", "cls")]}
        )

        self.assertEqual(
            {
                "before": index.value("receiver", 1),
                "first": index.value("receiver", 2),
                "same_line": index.value("receiver", 3),
                "after": index.value("receiver", 4),
            },
            {"before": "", "first": "self", "same_line": "cls", "after": "cls"},
        )

    def test_resolves_chained_aliases_at_the_use_line(self) -> None:
        """Responsibilities: _receiver alias chain result_."""
        index = PythonProxyScopeAliasIndex(
            {"receiver": [(2, "receiver", "other")], "other": [(5, "other", "self")]}
        )

        self.assertEqual(index.resolve("other", 5), "self")
