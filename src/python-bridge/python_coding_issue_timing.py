from __future__ import annotations

import ast
from collections.abc import Callable
from time import perf_counter

from implementation.types import JsonObject
from implementation.rules.constants import PYTHON_NODE_RULE_ANALYSIS_STAGE

PythonAstIssueAnalysis = Callable[[ast.AST], list[JsonObject]]


class PythonCodingIssueTiming:
    """Responsibilities: _proxy rule timing_, _node rule timing aggregation_."""

    def _collect_proxy_nodes(
        self,
        nodes: list[ast.AST],
        proxy_issues: list[JsonObject],
    ) -> None:
        """Responsibilities: _timed proxy analysis pass_."""
        started = perf_counter()
        try:
            for node in nodes:
                proxy_issues.extend(self.proxy_analysis(node))
        finally:
            self.timings["proxy-analysis"] = (perf_counter() - started) * 1000

    def _collect_rule_nodes(
        self,
        nodes: list[ast.AST],
        issues: list[JsonObject],
    ) -> None:
        """Responsibilities: _coding rule nodes_."""
        started = perf_counter()
        try:
            for node in nodes:
                issues.extend(self.node_analysis(node))
        finally:
            elapsed_seconds = perf_counter() - started
            self.timings[PYTHON_NODE_RULE_ANALYSIS_STAGE] = elapsed_seconds * 1000

    def __init__(
        self,
        proxy_analysis: PythonAstIssueAnalysis,
        node_analysis: PythonAstIssueAnalysis,
    ) -> None:
        """Responsibilities: _initialization coding timing_."""
        self.proxy_analysis: PythonAstIssueAnalysis = proxy_analysis
        self.node_analysis: PythonAstIssueAnalysis = node_analysis
        self.timings: dict[str, float] = {}

    def collect(
        self,
        nodes: list[ast.AST],
        proxy_issues: list[JsonObject],
        issues: list[JsonObject],
    ) -> None:
        """Responsibilities: _timed coding issue collection_."""
        self._collect_proxy_nodes(nodes, proxy_issues)
        self._collect_rule_nodes(nodes, issues)
        rule_time = sum(
            duration
            for name, duration in self.timings.items()
            if name.startswith("rule.")
        )
        self.timings["rule-dispatch-overhead"] = max(
            0.0,
            self.timings.get(PYTHON_NODE_RULE_ANALYSIS_STAGE, 0.0) - rule_time,
        )

    def durations(self) -> dict[str, float]:
        """Responsibilities: _coding issue timing snapshot_."""
        snapshot: dict[str, float] = {}
        for name, duration in self.timings.items():
            snapshot[name] = duration
        return snapshot
