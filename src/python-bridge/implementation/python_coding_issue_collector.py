from __future__ import annotations

import ast
from collections.abc import Callable
from functools import cached_property
from time import perf_counter

from implementation.protocols import PythonCodingIssueComponentsContract
from implementation.rules.constants import (
    PYTHON_PRECEDENCE_NODE_TYPES,
    STAGE_TYPES,
)
from implementation.types import JsonObject
from implementation.rules.constants import PYTHON_OPERATOR_PRECEDENCE_STAGE
from python_coding_issue_timing import PythonCodingIssueTiming

PythonRuleStage = Callable[[ast.AST], list[JsonObject]]
PythonProxyAnalysis = Callable[[ast.AST], list[JsonObject]]
PythonRuleStageEntry = tuple[PythonRuleStage, str]
PythonRuleStageEntries = dict[type[ast.AST], tuple[PythonRuleStageEntry, ...]]


class PythonCodingIssueCollector:
    """Responsibilities: _rule stage coordination_, _AST issue aggregation_."""

    def _timed_stage(
        self, stage: PythonRuleStage, stage_name: str, node: ast.AST
    ) -> list[JsonObject]:
        """Responsibilities: _timed Python rule stage_."""
        started = perf_counter()
        issues = stage(node)
        elapsed_ms = (perf_counter() - started) * 1000
        previous_ms = self.timings.get(stage_name, 0.0)
        self.timings[stage_name] = previous_ms + elapsed_ms
        return issues

    def _timed_precedence(self, node: ast.AST) -> list[JsonObject]:
        """Responsibilities: _timed operator precedence stage_."""
        if type(node) not in PYTHON_PRECEDENCE_NODE_TYPES:
            return []
        started = perf_counter()
        issues = self.components.precedence_issues(node)
        elapsed_ms = (perf_counter() - started) * 1000
        previous_ms = self.timings.get(PYTHON_OPERATOR_PRECEDENCE_STAGE, 0.0)
        self.timings[PYTHON_OPERATOR_PRECEDENCE_STAGE] = previous_ms + elapsed_ms
        return issues

    def __init__(
        self,
        components: PythonCodingIssueComponentsContract,
        stages: list[PythonRuleStage],
        nodes: list[ast.AST],
        proxy_analysis: PythonProxyAnalysis,
    ) -> None:
        """Responsibilities: _initialization Python issue collection_."""
        self.components: PythonCodingIssueComponentsContract = components
        self.stages: list[PythonRuleStage] = stages
        self.nodes: list[ast.AST] = nodes
        self.timing: PythonCodingIssueTiming = PythonCodingIssueTiming(
            proxy_analysis, self.collect_node
        )
        self.timings: dict[str, float] = self.timing.timings

    @cached_property
    def stage_entries(self) -> PythonRuleStageEntries:
        """Responsibilities: _precomputed Python rule dispatch_."""
        return {
            node_type: tuple(
                (self.stages[index], f"rule.{self.stages[index].__name__}")
                for index in stage_indexes
            )
            for node_type, stage_indexes in STAGE_TYPES.items()
        }

    @cached_property
    def rule_stage_catalog(self) -> list[str]:
        """Responsibilities: _Python rule stage catalog_."""
        return [f"rule.{stage.__name__}" for stage in self.stages]

    def collect(self) -> list[JsonObject]:
        """Responsibilities: _collection Python coding issues_."""
        self.components.prepare()
        proxy_issues: list[JsonObject] = []
        issues: list[JsonObject] = self.components.global_issues()
        self.timing.collect(self.components.source_nodes(), proxy_issues, issues)
        return proxy_issues + issues

    def collect_node(self, node: ast.AST) -> list[JsonObject]:
        """Responsibilities: _collection issues Python AST_."""
        node_type = type(node)
        stage_entries = self.stage_entries.get(node_type)
        if stage_entries is None and node_type not in PYTHON_PRECEDENCE_NODE_TYPES:
            return []
        issues: list[JsonObject] = []
        for stage, stage_name in stage_entries or ():
            issues.extend(self._timed_stage(stage, stage_name, node))
        issues.extend(self._timed_precedence(node))
        return issues
