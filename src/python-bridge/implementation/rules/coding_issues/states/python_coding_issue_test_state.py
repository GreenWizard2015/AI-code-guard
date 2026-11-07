from __future__ import annotations

import ast
from functools import cached_property

from implementation.ast.protocols import (
    PythonSubtestAliasesContract,
    PythonTestOrderDependencyContract,
)
from implementation.references.test_assertions.python_subtest_aliases import (
    PythonSubtestAliases,
)
from implementation.references.test_assertions.python_subtest_aliases_options import (
    PythonSubtestAliasesOptions,
)
from implementation.rules.call_analysis.testing.python_test_order_dependency import (
    PythonTestOrderDependency,
)
from implementation.rules.control_flow.python_coding_issue_stages import (
    PythonCodingIssueStages,
)
from implementation.rules.protocols import (
    PythonCodingIssueComponentContextContract,
    PythonCodingIssueStagesContract,
    PythonCodingIssueTestStateContract,
    PythonDecoratorRuleContract,
)


class PythonCodingIssueTestState(PythonCodingIssueTestStateContract):
    """Responsibilities: _test structure analysis_, _simple Python stages_."""

    _context: PythonCodingIssueComponentContextContract
    _decorator_rules: PythonDecoratorRuleContract

    @cached_property
    def _subtest_alias_state(self) -> PythonSubtestAliasesContract:
        """Responsibilities: _subtest alias state_."""
        context = self._context
        options = PythonSubtestAliasesOptions(
            context.tree(),
            context.node_index(),
            context.aliases().containers.subtest_container_aliases,
            context.aliases().containers.subtest_container_aliases.container_keys(),
            context.aliases().values.reference_aliases,
        )
        return PythonSubtestAliases(options)

    @cached_property
    def _simple_stage_state(self) -> PythonCodingIssueStagesContract:
        """Responsibilities: _simple rule stages_."""
        return PythonCodingIssueStages(
            self._context.aliases().containers.simple_container_aliases.container_keys(),
            self._decorator_rules,
            self._subtest_alias_state,
        )

    @cached_property
    def _test_order_state(self) -> PythonTestOrderDependencyContract:
        """Responsibilities: _test-order analysis_."""
        match self._context.tree():
            case ast.Module() as tree:
                return PythonTestOrderDependency(tree, self._context.node_index())
            case _:
                raise TypeError("Python test analysis requires a module tree")

    def __init__(
        self,
        context: PythonCodingIssueComponentContextContract,
        decorator_rules: PythonDecoratorRuleContract,
    ) -> None:
        """Responsibilities: _test state initialization_."""
        self._context: PythonCodingIssueComponentContextContract = context
        self._decorator_rules: PythonDecoratorRuleContract = decorator_rules

    def subtest_aliases(self) -> PythonSubtestAliasesContract:
        """Responsibilities: _subtest alias access_."""
        return self._subtest_alias_state

    def simple_stages(self) -> PythonCodingIssueStagesContract:
        """Responsibilities: _simple stage access_."""
        return self._simple_stage_state

    def test_order(self) -> PythonTestOrderDependencyContract:
        """Responsibilities: _test-order access_."""
        return self._test_order_state
