from __future__ import annotations

import ast
from time import perf_counter

from implementation.ast.callables.coding_issue_protocols import PythonCodingIssueNodeContract
from implementation.ast.callables.constants import PYTHON_EXPLICITLY_TIMED_RULES
from implementation.ast.protocols import PythonCodingIssueTimingContract
from implementation.rules.constants import (
    PYTHON_OPERATOR_PRECEDENCE_STAGE,
)
from implementation.rules.protocols import PythonCodingIssueComponentsContract
from implementation.types import CallablePythonRuleStage, JsonObject


class PythonCodingIssueNode(PythonCodingIssueNodeContract):
    """Responsibilities: _AST rule dispatch_, _stage duration recording_."""

    def __init__(
        self,
        components: PythonCodingIssueComponentsContract,
        timing: PythonCodingIssueTimingContract,
    ) -> None:
        """Responsibilities: _AST node state_."""
        self._components: PythonCodingIssueComponentsContract = components
        self._timing: PythonCodingIssueTimingContract = timing

    def timed_stage(
        self,
        node: ast.AST,
        stage: CallablePythonRuleStage,
        stage_name: str,
    ) -> list[JsonObject]:
        """Responsibilities: _Python rule stage timing_."""
        started = perf_counter()
        issues = stage(node)
        elapsed_ms = (perf_counter() - started) * 1000
        self._timing.add_duration(stage_name, elapsed_ms)
        measured_rules = set()
        for issue in issues:
            rule_id = issue.get("kind")
            if not rule_id:
                continue
            if stage_name == f"rule.{rule_id}":
                continue
            if rule_id in PYTHON_EXPLICITLY_TIMED_RULES:
                continue
            measured_rules.add(rule_id)
        for rule_id in measured_rules:
            self._timing.add_duration(f"rule.{rule_id}", elapsed_ms)
        return issues

    def timed_precedence(self, node: ast.AST) -> list[JsonObject]:
        """Responsibilities: _operator precedence timing_."""
        started = perf_counter()
        issues = self._components.precedence_issues(node)
        elapsed_ms = (perf_counter() - started) * 1000
        self._timing.add_duration(PYTHON_OPERATOR_PRECEDENCE_STAGE, elapsed_ms)
        return issues
