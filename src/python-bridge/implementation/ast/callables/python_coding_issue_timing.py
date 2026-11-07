from __future__ import annotations

import ast
from collections.abc import Iterator
from contextlib import contextmanager
from time import perf_counter

from implementation.ast.callables.coding_issue_protocols import (
    CallablePythonDispatchedNodeAnalysis,
    PythonRuleNodeDispatchIndex,
)
from implementation.rules.constants import PYTHON_NODE_RULE_ANALYSIS_STAGE
from implementation.types import CallablePythonAstIssueAnalysis, JsonObject


class PythonCodingIssueTiming:
    """Responsibilities: _proxy rule timing_, _node rule timing aggregation_."""

    def _publish_durations(self, started: float, proxy_duration: float) -> None:
        """Responsibilities: _node-stage timing publication_."""
        elapsed_ms = (perf_counter() - started) * 1000
        proxy_elapsed_ms = proxy_duration * 1000
        self._timings.update({"proxy-analysis": proxy_elapsed_ms, PYTHON_NODE_RULE_ANALYSIS_STAGE: elapsed_ms})

    def _collect_node_stage(
        self,
        nodes: list[ast.AST],
        proxy_issues: list[JsonObject],
        rule_issues: list[JsonObject],
    ) -> None:
        """Responsibilities: _combined AST issue dispatch_."""
        started = perf_counter()
        proxy_duration = 0.0
        proxy_analysis, node_analysis, node_dispatch = self._proxy_analysis, self._node_analysis, self._node_dispatch
        try:
            for node in nodes:
                dispatch = node_dispatch.get(type(node))
                if dispatch is not None and dispatch.checks_proxy:
                    proxy_started = perf_counter()
                    proxy_issues.extend(proxy_analysis(node))
                    proxy_duration += perf_counter() - proxy_started
                if dispatch is not None and (dispatch.stages or dispatch.checks_precedence):
                    rule_issues.extend(node_analysis(node, dispatch))
        finally:
            self._publish_durations(started, proxy_duration)

    def __init__(
        self,
        proxy_analysis: CallablePythonAstIssueAnalysis,
        node_analysis: CallablePythonDispatchedNodeAnalysis,
        node_dispatch: PythonRuleNodeDispatchIndex,
    ) -> None:
        """Responsibilities: _initialization coding timing_."""
        self._proxy_analysis: CallablePythonAstIssueAnalysis = proxy_analysis
        self._node_analysis: CallablePythonDispatchedNodeAnalysis = node_analysis
        self._node_dispatch: PythonRuleNodeDispatchIndex = node_dispatch
        self._timings: dict[str, float] = {}

    def collect(
        self,
        nodes: list[ast.AST],
        proxy_issue_output: list[JsonObject],
        rule_issue_output: list[JsonObject],
    ) -> None:
        """Responsibilities: _timed coding issue collection_."""
        self._collect_node_stage(nodes, proxy_issue_output, rule_issue_output)
        rule_time = sum(duration for name, duration in self._timings.items() if name.startswith("rule."))
        analysis_time = self._timings.get(PYTHON_NODE_RULE_ANALYSIS_STAGE, 0.0)
        proxy_time = self._timings.get("proxy-analysis", 0.0)
        self._timings.update({"rule-dispatch-overhead": max(0.0, analysis_time - rule_time - proxy_time)})

    def add_duration(self, name: str, elapsed_ms: float) -> None:
        """Responsibilities: _rule stage duration accumulation_."""
        self._timings[name] = self._timings.get(name, 0.0) + elapsed_ms

    @contextmanager
    def measure(self, name: str) -> Iterator[None]:
        """Responsibilities: _coding issue stage duration_."""
        started = perf_counter()
        try:
            yield
        finally:
            self.add_duration(name, (perf_counter() - started) * 1000)

    def durations(self) -> dict[str, float]:
        """Responsibilities: _coding issue timing snapshot_."""
        return dict(self._timings.items())
