from __future__ import annotations

from implementation.rules.coding_issues.states.python_coding_issue_flow_state import (
    PythonCodingIssueFlowState,
)
from implementation.rules.coding_issues.states.python_coding_issue_test_state import (
    PythonCodingIssueTestState,
)
from implementation.rules.protocols import (
    PythonCodingIssueComponentContextContract,
    PythonCodingIssueFlowStateContract,
    PythonCodingIssueStructureBundleContract,
    PythonCodingIssueTestStateContract,
    PythonDecoratorRuleContract,
)
from implementation.rules.types import PythonCodingIssueStructureBundle


class PythonCodingIssueStructureState:
    """Responsibilities: _flow analysis_, _test analysis_, _structure bundle assembly_."""

    _flow: PythonCodingIssueFlowStateContract
    _tests: PythonCodingIssueTestStateContract
    _context: PythonCodingIssueComponentContextContract

    def __init__(
        self,
        context: PythonCodingIssueComponentContextContract,
        decorator_rules: PythonDecoratorRuleContract,
    ) -> None:
        """Responsibilities: _structure state initialization_."""
        flow = PythonCodingIssueFlowState(context)
        tests = PythonCodingIssueTestState(context, decorator_rules)
        self._flow: PythonCodingIssueFlowStateContract = flow
        self._tests: PythonCodingIssueTestStateContract = tests
        self._context: PythonCodingIssueComponentContextContract = context

    def flow(self) -> PythonCodingIssueFlowStateContract:
        """Responsibilities: _flow state access_."""
        return self._flow

    def tests(self) -> PythonCodingIssueTestStateContract:
        """Responsibilities: _test state access_."""
        return self._tests

    def bundle(self) -> PythonCodingIssueStructureBundleContract:
        """Responsibilities: _rule bundle assembly_."""
        subtest_aliases = self.tests().subtest_aliases()
        control_flow = self.flow().control_flow()
        precedence = self.flow().precedence()
        simple_stages = self.tests().simple_stages()
        source_nodes = self._context.node_index().nodes(self._context.tree())
        test_order = self.tests().test_order()
        return PythonCodingIssueStructureBundle(
            subtest_aliases,
            control_flow,
            precedence,
            simple_stages,
            source_nodes,
            test_order,
        )
