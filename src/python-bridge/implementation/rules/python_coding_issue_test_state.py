from __future__ import annotations

from implementation.protocols import (
    PythonCodingIssueComponentContextContract,
    PythonCodingIssueStagesContract,
    PythonDecoratorRulesContract,
    PythonSubtestAliasesContract,
    PythonTestOrderDependencyContract,
)
from implementation.references.test_assertions.subtest_aliases import (
    PythonSubtestAliases,
    PythonSubtestAliasesOptions,
)
from implementation.rules.call_analysis.testing.python_test_order_dependency import (
    PythonTestOrderDependency,
)
from implementation.rules.control_flow.python_coding_issue_stages import (
    PythonCodingIssueStages,
)


class PythonCodingIssueTestState:
    """Responsibilities: _test structure analysis_, _simple Python stages_."""

    _subtest_aliases: PythonSubtestAliasesContract
    _simple_stages: PythonCodingIssueStagesContract
    _test_order: PythonTestOrderDependencyContract

    def __init__(
        self,
        context: PythonCodingIssueComponentContextContract,
        decorator_rules: PythonDecoratorRulesContract,
    ) -> None:
        """Responsibilities: _test state initialization_."""
        subtest_aliases = PythonSubtestAliases(
            PythonSubtestAliasesOptions(
                context.tree,
                context.node_index,
                context.subtest_container_aliases,
                context.subtest_container_aliases.container_keys,
                context.reference_aliases,
            )
        )
        self._subtest_aliases: PythonSubtestAliasesContract = subtest_aliases
        self._simple_stages: PythonCodingIssueStagesContract = PythonCodingIssueStages(
            context.simple_container_aliases.container_keys,
            decorator_rules,
            subtest_aliases,
        )
        self._test_order: PythonTestOrderDependencyContract = PythonTestOrderDependency(
            context.tree
        )

    def subtest_aliases(self) -> PythonSubtestAliasesContract:
        """Responsibilities: _subtest alias access_."""
        return self._subtest_aliases

    def simple_stages(self) -> PythonCodingIssueStagesContract:
        """Responsibilities: _simple stage access_."""
        return self._simple_stages

    def test_order(self) -> PythonTestOrderDependencyContract:
        """Responsibilities: _test-order access_."""
        return self._test_order
