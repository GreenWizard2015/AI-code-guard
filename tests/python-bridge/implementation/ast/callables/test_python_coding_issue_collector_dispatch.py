import ast
import unittest

from implementation.ast.callables.python_coding_issue_collector import (
    PythonCodingIssueCollector,
    PythonRuleNodeDispatch,
)
from python_collector_fixture import PythonCollectorFixture


class PythonCodingIssueCollectorDispatchTest(unittest.TestCase):
    """Responsibilities: _AST node dispatch_, _Python diagnostic collection_."""

    def test_collection_reports_diagnostics_for_supported_operators(self) -> None:
        """Responsibilities: _operator diagnostic results_."""
        source = "if left and right or third:\n    value = first + second / third\n"
        tree = ast.parse(source)
        fixture = PythonCollectorFixture()
        collector = fixture.collector(tree, source)
        issues = PythonCodingIssueCollector.collect(collector)
        dispatch = collector.node_analysis_index

        self.assertEqual(
            {
                "issue_kinds": {issue["kind"] for issue in issues},
                "proxy_dispatch": {
                    node_type.__name__: (entry.checks_proxy, bool(entry.stages) or entry.checks_precedence)
                    for node_type, entry in dispatch.items()
                    if entry.checks_proxy
                },
            },
            {
                "issue_kinds": {"mixed-arithmetic-precedence", "mixed-boolean-precedence"},
                "proxy_dispatch": {
                    "FunctionDef": (True, True),
                    "AsyncFunctionDef": (True, True),
                    "Lambda": (True, False),
                },
            },
        )

    def test_direct_node_analysis_ignores_unmatched_nodes(self) -> None:
        """Responsibilities: _unmatched AST node handling_."""
        source = "value = 1\n"
        tree = ast.parse(source)
        fixture = PythonCollectorFixture()
        collector = fixture.collector(tree, source)

        self.assertEqual(
            PythonCodingIssueCollector.collect_node(
                collector,
                ast.Load(),
                PythonRuleNodeDispatch([], checks_precedence=False),
            ),
            [],
        )
