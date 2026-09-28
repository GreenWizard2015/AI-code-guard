from __future__ import annotations


from time import perf_counter
from typing import Callable
import ast

from implementation.types import JsonObject

PythonAstIssueAnalysis = Callable[[ast.AST], list[JsonObject]]


class PythonCodingIssueTiming:
    """Responsibilities: _Python coding issue timing_."""

    def _collect_proxy_node(
        self,
        node: ast.AST,
        proxy_issues: list[JsonObject],
    ) -> None:
        """Responsibilities: _timed proxy node analysis_."""
        started = perf_counter()
        proxy_issues.extend(self.proxy_analysis(node))
        elapsed_ms = (perf_counter() - started) * 1000
        previous_ms = self.timings.get("proxy-analysis", 0.0)
        self.timings["proxy-analysis"] = previous_ms + elapsed_ms

    def _collect_rule_node(
        self,
        node: ast.AST,
        issues: list[JsonObject],
    ) -> None:
        """Responsibilities: _timed coding rule analysis_."""
        started = perf_counter()
        issues.extend(self.node_analysis(node))
        elapsed_ms = (perf_counter() - started) * 1000
        previous_ms = self.timings.get("node-rule-analysis", 0.0)
        self.timings["node-rule-analysis"] = previous_ms + elapsed_ms

    def _record_dispatch_overhead(self) -> None:
        """Responsibilities: _coding rule dispatch overhead_."""
        rule_time = sum(
            duration
            for name, duration in self.timings.items()
            if name.startswith("rule.")
        )
        self.timings["rule-dispatch-overhead"] = max(
            0.0, self.timings.get("node-rule-analysis", 0.0) - rule_time
        )

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
        for node in nodes:
            self._collect_proxy_node(node, proxy_issues)
            self._collect_rule_node(node, issues)
        self._record_dispatch_overhead()

    def durations(self) -> dict[str, float]:
        """Responsibilities: _coding issue timing snapshot_."""
        snapshot: dict[str, float] = {}
        for name, duration in self.timings.items():
            snapshot[name] = duration
        return snapshot

