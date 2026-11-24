import ast
import unittest
from unittest.mock import Mock

from implementation.ast.callables.coding_issue_protocols import (
    PythonRuleNodeDispatchContract,
)
from implementation.ast.callables.python_coding_issue_collector import (
    PythonRuleNodeDispatch,
)
from implementation.ast.callables.python_coding_issue_node import PythonCodingIssueNode
from implementation.ast.callables.python_coding_issue_timing import (
    PythonCodingIssueTiming,
)
from implementation.rules.constants import PYTHON_NODE_RULE_ANALYSIS_STAGE
from implementation.rules.protocols import PythonCodingIssueComponentsContract
from implementation.types import JsonObject, PythonRuleStageEntry


class PythonCodingIssueTimingTest(unittest.TestCase):
    """Responsibilities: _rule duration accumulation_, _independent stage totals_."""

    def test_first_duration_initializes_the_stage_total(self) -> None:
        """Responsibilities: _initial stage duration_."""
        timing = PythonCodingIssueTiming(lambda _node: [], lambda _node, _dispatch: [], {})
        timing.add_duration("rule.sample", 1.25)

        self.assertEqual(timing.durations(), {"rule.sample": 1.25})

    def test_repeated_durations_accumulate_for_the_same_stage(self) -> None:
        """Responsibilities: _repeated stage duration totals_."""
        timing = PythonCodingIssueTiming(lambda _node: [], lambda _node, _dispatch: [], {})
        timing.add_duration("rule.sample", 1.25)
        timing.add_duration("rule.sample", 2.75)

        self.assertEqual(timing.durations(), {"rule.sample": 4.0})

    def test_duration_totals_remain_separate_by_stage(self) -> None:
        """Responsibilities: _stage duration ownership_."""
        timing = PythonCodingIssueTiming(lambda _node: [], lambda _node, _dispatch: [], {})
        timing.add_duration("rule.sample", 1.25)
        timing.add_duration("rule.other", 4.0)

        self.assertEqual(
            timing.durations(),
            {"rule.sample": 1.25, "rule.other": 4.0},
        )

    def test_node_analysis_reuses_the_dispatch_record_for_matching_nodes(self) -> None:
        """Responsibilities: _single node dispatch lookup_."""
        dispatch = PythonRuleNodeDispatch(
            [PythonRuleStageEntry(lambda _node: [], "rule.name")],
            checks_precedence=False,
        )
        collected: list[tuple[ast.AST, PythonRuleNodeDispatchContract]] = []

        def collect_node(
            node: ast.AST,
            node_dispatch: PythonRuleNodeDispatchContract,
        ) -> list[JsonObject]:
            """Responsibilities: _dispatch record observation_."""
            collected.append((node, node_dispatch))
            return []

        timing = PythonCodingIssueTiming(lambda _node: [], collect_node, {ast.Name: dispatch})
        name = ast.Name(id="value", ctx=ast.Load())
        constant = ast.Constant(value=1)
        timing.collect([name, constant], [], [])

        self.assertEqual(
            {"nodes": [ast.unparse(item[0]) for item in collected], "same_dispatch": collected[0][1] is dispatch},
            {"nodes": ["value"], "same_dispatch": True},
        )

    def test_combined_pass_preserves_proxy_and_rule_issue_order(self) -> None:
        """Responsibilities: _combined issue output ordering_."""
        proxy_nodes: list[str] = []
        rule_nodes: list[str] = []

        def proxy_analysis(node: ast.AST) -> list[JsonObject]:
            """Responsibilities: _proxy candidate observation_."""
            proxy_nodes.append(ast.unparse(node))
            return [{"kind": "proxy"}]

        def node_analysis(node: ast.AST, _dispatch: PythonRuleNodeDispatchContract) -> list[JsonObject]:
            """Responsibilities: _rule candidate observation_."""
            rule_nodes.append(ast.unparse(node))
            return [{"kind": "rule"}]

        rule_dispatch = PythonRuleNodeDispatch(
            [PythonRuleStageEntry(lambda _node: [], "rule.name")],
            checks_precedence=False,
        )
        proxy_dispatch = PythonRuleNodeDispatch([], checks_precedence=False, checks_proxy=True)
        timing = PythonCodingIssueTiming(
            proxy_analysis,
            node_analysis,
            {ast.Name: rule_dispatch, ast.Lambda: proxy_dispatch, ast.FunctionDef: proxy_dispatch},
        )
        nodes = list(ast.walk(ast.parse("def target():\n    return lambda: target\n")))
        proxy_issues: list[JsonObject] = []
        rule_issues: list[JsonObject] = []
        timing.collect(nodes, proxy_issues, rule_issues)

        self.assertEqual(
            (proxy_nodes, rule_nodes, len(proxy_issues), len(rule_issues), set(timing.durations())),
            (
                ["def target():\n    return lambda: target", "lambda: target"],
                ["target"],
                2,
                1,
                {"proxy-analysis", PYTHON_NODE_RULE_ANALYSIS_STAGE, "rule-dispatch-overhead"},
            ),
        )

    def test_empty_rule_results_skip_diagnostic_timing_but_keep_stage_duration(self) -> None:
        """Responsibilities: _empty stage duration preservation_."""
        timing = PythonCodingIssueTiming(lambda _node: [], lambda _node, _dispatch: [], {})
        components = Mock(spec=PythonCodingIssueComponentsContract)
        coding_issue_node = PythonCodingIssueNode(components, timing)
        stage_calls: list[ast.AST] = []

        def empty_stage(node: ast.AST) -> list[JsonObject]:
            """Responsibilities: _empty rule result production_."""
            stage_calls.append(node)
            return []

        node = ast.Constant(value=1)
        result = coding_issue_node.timed_stage(node, empty_stage, "rule.sample")

        self.assertEqual((result, stage_calls, set(timing.durations())), ([], [node], {"rule.sample"}))
