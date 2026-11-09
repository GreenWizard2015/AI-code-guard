from __future__ import annotations

import ast
from dataclasses import dataclass
from functools import cached_property
from time import perf_counter

from implementation.ast.callables.coding_issue_protocols import (
    PythonCodingIssueNodeContract,
    PythonRuleNodeDispatchContract,
    PythonRuleNodeDispatchIndex,
    PythonRuleStageEntryContract,
)
from implementation.ast.callables.constants import PYTHON_RULE_STAGE_NAMES
from implementation.ast.callables.python_coding_issue_node import PythonCodingIssueNode
from implementation.ast.callables.python_coding_issue_timing import (
    PythonCodingIssueTiming,
)
from implementation.ast.protocols import PythonCodingIssueTimingContract
from implementation.rules.constants import (
    PYTHON_PRECEDENCE_NODE_TYPES,
    STAGE_TYPES,
)
from implementation.rules.protocols import (
    PythonCodingIssueComponentsContract,
    PythonCodingIssueExecutionPlanContract,
)
from implementation.types import (
    CallablePythonRuleStage,
    JsonObject,
    PythonRuleStageEntry,
)


@dataclass(frozen=True)
class PythonRuleNodeDispatch:
    """Responsibilities: _AST node rule stages_, _precedence eligibility_."""

    stages: list[PythonRuleStageEntryContract]
    checks_precedence: bool
    checks_proxy: bool = False


class PythonCodingIssueCollector:
    """Responsibilities: _rule stage coordination_, _AST issue aggregation_."""

    def _stage_name(self, stage: CallablePythonRuleStage) -> str:
        """Responsibilities: _rule timing identity resolution_."""
        rule_id = PYTHON_RULE_STAGE_NAMES.get(stage.__name__)
        if rule_id is not None:
            return f"rule.{rule_id}"
        return f"python-rule-stage.{stage.__name__}"

    def __init__(
        self,
        components: PythonCodingIssueComponentsContract,
        execution_plan: PythonCodingIssueExecutionPlanContract,
    ) -> None:
        """Responsibilities: _initialization Python issue collection_."""
        self._components: PythonCodingIssueComponentsContract = components
        self._execution_plan: PythonCodingIssueExecutionPlanContract = execution_plan
        self._stages: list[CallablePythonRuleStage] = execution_plan.rule_stages
        self._timing: PythonCodingIssueTimingContract = PythonCodingIssueTiming(
            execution_plan.proxy_analyzer.analyze,
            self.collect_node,
            self.node_analysis_index,
        )
        self._node_context: PythonCodingIssueNodeContract = PythonCodingIssueNode(
            components,
            self._timing,
        )

    @cached_property
    def node_analysis_index(self) -> PythonRuleNodeDispatchIndex:
        """Responsibilities: _Python AST analysis lookup_."""
        proxy_node_types = {ast.FunctionDef, ast.AsyncFunctionDef, ast.Lambda}
        node_types = set(STAGE_TYPES)
        node_types.update(PYTHON_PRECEDENCE_NODE_TYPES)
        node_types.update(proxy_node_types)
        return {
            node_type: PythonRuleNodeDispatch(
                [
                    PythonRuleStageEntry(self._stages[index], self._stage_name(self._stages[index]))
                    for index in STAGE_TYPES.get(node_type, ())
                ],
                node_type in PYTHON_PRECEDENCE_NODE_TYPES,
                node_type in proxy_node_types,
            )
            for node_type in node_types
        }

    @cached_property
    def rule_stage_catalog(self) -> list[str]:
        """Responsibilities: _Python rule stage catalog_."""
        return [self._stage_name(stage) for stage in self._stages]

    def collect(self) -> list[JsonObject]:
        """Responsibilities: _collection Python coding issues_."""
        started = perf_counter()
        self._components.prepare()
        self._timing.add_duration("prepare", (perf_counter() - started) * 1000)
        proxy_issues: list[JsonObject] = []
        started = perf_counter()
        issues: list[JsonObject] = self._components.global_issues()
        self._timing.add_duration("global-issues", (perf_counter() - started) * 1000)
        started = perf_counter()
        nodes = self._execution_plan.source_nodes
        self._timing.add_duration("source-nodes", (perf_counter() - started) * 1000)
        self._timing.collect(nodes, proxy_issues, issues)
        for name, duration_ms in self._components.phase_timings().items():
            self._timing.add_duration(name, duration_ms)
        return proxy_issues + issues

    def timing(self) -> PythonCodingIssueTimingContract:
        """Responsibilities: _analysis timing access_."""
        return self._timing

    def collect_node(
        self,
        node: ast.AST,
        node_dispatch: PythonRuleNodeDispatchContract,
    ) -> list[JsonObject]:
        """Responsibilities: _collection issues Python AST_."""
        if len(node_dispatch.stages) == 1 and not node_dispatch.checks_precedence:
            stage_entry = node_dispatch.stages[0]
            if stage_entry is not None:
                return self._node_context.timed_stage(node, stage_entry.stage, stage_entry.name)
        issues: list[JsonObject] = []
        for stage_entry in node_dispatch.stages:
            issues.extend(self._node_context.timed_stage(node, stage_entry.stage, stage_entry.name))
        if node_dispatch.checks_precedence:
            issues.extend(self._node_context.timed_precedence(node))
        return issues
