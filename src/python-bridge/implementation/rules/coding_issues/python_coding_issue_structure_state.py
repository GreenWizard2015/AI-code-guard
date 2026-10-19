from __future__ import annotations

from implementation.protocols import (
    PythonCodingIssueComponentContextContract,
    PythonCodingIssueFlowStateContract,
    PythonCodingIssueTestStateContract,
    PythonDecoratorRulesContract,
)
from implementation.rules.coding_issues.python_coding_issue_flow_state import (
    PythonCodingIssueFlowState,
)
from implementation.rules.python_coding_issue_test_state import (
    PythonCodingIssueTestState,
)


class PythonCodingIssueStructureState:
    """Responsibilities: _flow state_, _test state_."""

    _flow: PythonCodingIssueFlowStateContract
    _tests: PythonCodingIssueTestStateContract

    def __init__(
        self,
        context: PythonCodingIssueComponentContextContract,
        decorator_rules: PythonDecoratorRulesContract,
    ) -> None:
        """Responsibilities: _structure state initialization_."""
        flow = PythonCodingIssueFlowState(context)
        tests = PythonCodingIssueTestState(context, decorator_rules)
        self._flow: PythonCodingIssueFlowStateContract = flow
        self._tests: PythonCodingIssueTestStateContract = tests

    def flow(self) -> PythonCodingIssueFlowStateContract:
        """Responsibilities: _flow state access_."""
        return self._flow

    def tests(self) -> PythonCodingIssueTestStateContract:
        """Responsibilities: _test state access_."""
        return self._tests
