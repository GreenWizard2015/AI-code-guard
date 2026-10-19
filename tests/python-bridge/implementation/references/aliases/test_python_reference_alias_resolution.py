import ast
import unittest

from implementation.references.aliases.python_reference_aliases import PythonReferenceAliases


class PythonReferenceAliasResolutionTest(unittest.TestCase):
    """Responsibilities: _acyclic suffix reuse_, _cycle root identity_."""

    def test_compresses_acyclic_alias_suffixes(self) -> None:
        """Responsibilities: _acyclic alias resolution cache_."""
        aliases = PythonReferenceAliases()
        source = "\n".join(f"alias_{index} = alias_{index + 1}" for index in range(999))
        aliases.collect(ast.parse(source + "\nalias_999 = worker\n"))

        self.assertEqual(
            {
                "terminal": aliases.resolved_name("alias_0", frozenset({"worker"})),
                "suffix": aliases.target_ends_with("alias_998", "worker"),
                "cached_aliases": len(aliases._resolved_aliases),
            },
            {"terminal": "worker", "suffix": True, "cached_aliases": 1000},
        )

    def test_keeps_cycle_results_root_sensitive_and_rebuilds_cache(self) -> None:
        """Responsibilities: _cycle resolution cache lifecycle_."""
        aliases = PythonReferenceAliases()
        aliases.collect(ast.parse("prefix = first\nfirst = second\nsecond = first\n"))
        cycle_results = [aliases.resolved_name(name, frozenset()) for name in ("prefix", "first", "second")]
        aliases.collect(ast.parse("prefix = worker\n"))

        self.assertEqual(
            {"cycle_roots": cycle_results, "replacement": aliases.resolved_name("prefix", frozenset())},
            {"cycle_roots": ["first", "first", "second"], "replacement": "worker"},
        )

    def test_alias_resolution_caches_chains_in_linear_state(self) -> None:
        """Responsibilities: _alias graph memoization_."""
        resolution = PythonReferenceAliases()
        resolution.aliases.extend([{"name": "first", "target": "second"}, {"name": "second", "target": "terminal"}])
        resolution._rebuild_alias_index()

        self.assertEqual(
            {
                "first": resolution.resolved_name("first", frozenset()),
                "second": resolution.target_ends_with("second", "terminal"),
                "cached": resolution._resolved_aliases,
            },
            {"first": "terminal", "second": True, "cached": {"first": "terminal", "second": "terminal"}},
        )
