from __future__ import annotations

import ast
from collections.abc import Iterator
from contextlib import contextmanager
from time import perf_counter

from implementation.ast.protocols import (
    PythonSubtestAliasesContract,
    PythonTestOrderDependencyContract,
)
from implementation.ast.python_export_declaration_rules import (
    PythonExportDeclarationRules,
)
from implementation.protocols import PythonProxyCallableAnalyzerContract
from implementation.references.aliases.python_container_alias_batch import (
    PythonContainerAliasBatch,
)
from implementation.rules.coding_issues.primary_rule_protocols import PythonPrimaryRulesContract
from implementation.rules.coding_issues.python_default_parameter_issues import (
    PythonDefaultParameterIssues,
)
from implementation.rules.coding_issues.python_global_issue_collector import (
    PythonGlobalIssueCollector,
)
from implementation.rules.coding_issues.states.python_coding_issue_assembly import (
    PythonCodingIssueAssembly,
)
from implementation.rules.protocols import (
    PythonCallRulesContract,
    PythonCodingIssueComponentContextContract,
    PythonCodingIssueExecutionPlanContract,
    PythonCodingIssueStagesContract,
    PythonControlFlowIssuesContract,
    PythonFieldMutationCollectorContract,
    PythonGlobalIssueCollectorContract,
    PythonOperatorPrecedenceContract,
)
from implementation.rules.type_rule_protocols import (
    PythonSingleItemArrayStateRulesContract,
    PythonUnboundedTypeRulesContract,
    PythonUnionRulesContract,
    PythonUnnecessaryUndefinedCheckContract,
)
from implementation.rules.types import PythonCodingIssueExecutionPlan
from implementation.types import (
    CallablePythonPrepare,
    CallablePythonRuleStage,
    JsonObject,
)


class PythonCodingIssueComponents:
    """Responsibilities: _source analysis preparation_, _rule issue aggregation_, _export declaration policy_."""

    _context: PythonCodingIssueComponentContextContract
    _union_rules: PythonUnionRulesContract
    _field_mutations: PythonFieldMutationCollectorContract
    _proxy_analyzer: PythonProxyCallableAnalyzerContract
    _subtest_aliases: PythonSubtestAliasesContract
    _unnecessary_undefined_check: PythonUnnecessaryUndefinedCheckContract
    _array_state_rules: PythonSingleItemArrayStateRulesContract
    _unbounded_type_rules: PythonUnboundedTypeRulesContract
    _control_flow: PythonControlFlowIssuesContract
    _python_operator_precedence: PythonOperatorPrecedenceContract
    _simple_stages: PythonCodingIssueStagesContract
    _source_nodes: list[ast.AST]
    _test_order_dependency: PythonTestOrderDependencyContract
    _global_issue_collector: PythonGlobalIssueCollectorContract
    _phase_timings: dict[str, float]
    _execution_plan: PythonCodingIssueExecutionPlanContract

    def _module_type_issues(self) -> list[JsonObject]:
        """Responsibilities: _module type diagnostics_."""
        tree = self._context.tree()
        if type(tree) is not ast.Module:
            raise TypeError("Module rule analysis requires a module tree")
        issues = self._unbounded_type_rules.issues()
        default_parameter = PythonDefaultParameterIssues(tree, self._context.node_index())
        issues.extend(default_parameter.issues())
        issues.extend(self._test_order_dependency.issues())
        issues.extend(self._primary_branch_count(tree))
        export_rules = PythonExportDeclarationRules(tree, self._context.node_index())
        issues.extend(export_rules.issues())
        return issues

    @contextmanager
    def _measure_phase(self, name: str) -> Iterator[None]:
        """Responsibilities: _rule analysis stage timing_."""
        started = perf_counter()
        try:
            yield
        finally:
            self._phase_timings.update({name: (perf_counter() - started) * 1000})

    def _prepare_container_aliases(self, nodes: list[ast.AST]) -> None:
        """Responsibilities: _container alias state preparation_."""
        container_alias_batch = PythonContainerAliasBatch(
            [
                self._context.aliases().containers.simple_container_aliases,
                self._context.aliases().containers.subtest_container_aliases,
                self._context.aliases().containers.union_container_aliases,
                self._context.aliases().containers.field_container_aliases,
            ],
        )
        container_alias_batch.observe_all(nodes, self._context.tree())

    def _global_rule_issues(self) -> list[JsonObject]:
        """Responsibilities: _global rule aggregation_."""
        issues: list[JsonObject] = []
        with self._measure_phase("global-issues.collections"):
            issues.extend(self._global_issue_collector.collection_issues())
        with self._measure_phase("global-issues.state"):
            issues.extend(self._global_issue_collector.state_issues())
        self._phase_timings.update(
            {
                f"global-issues.{name}": duration_ms
                for name, duration_ms in self._global_issue_collector.timings_data().items()
            },
        )
        return issues

    def __init__(
        self,
        context: PythonCodingIssueComponentContextContract,
        primary: PythonPrimaryRulesContract,
    ) -> None:
        """Responsibilities: _coding issue component coordination_."""
        assembly = PythonCodingIssueAssembly(context, primary)
        bundle = assembly.assemble()
        type_state = bundle.type_state
        boundary_state = bundle.boundary_state
        structure_state = bundle.structure_state
        primary_rules = primary.rule_set()
        self._union_rules: PythonUnionRulesContract = type_state.union_rules
        self._field_mutations: PythonFieldMutationCollectorContract = boundary_state.field_mutations
        self._proxy_analyzer: PythonProxyCallableAnalyzerContract = boundary_state.proxy_analyzer
        self._subtest_aliases: PythonSubtestAliasesContract = structure_state.subtest_aliases
        self._unnecessary_undefined_check: PythonUnnecessaryUndefinedCheckContract = (
            boundary_state.unnecessary_undefined_check
        )
        self._array_state_rules: PythonSingleItemArrayStateRulesContract = bundle.array_state_rules
        self._unbounded_type_rules: PythonUnboundedTypeRulesContract = type_state.unbounded_type_rules
        self._control_flow: PythonControlFlowIssuesContract = structure_state.control_flow
        self._python_operator_precedence: PythonOperatorPrecedenceContract = structure_state.python_operator_precedence
        self._simple_stages: PythonCodingIssueStagesContract = structure_state.simple_stages
        self._context: PythonCodingIssueComponentContextContract = context
        self._test_order_dependency: PythonTestOrderDependencyContract = structure_state.test_order_dependency
        self._primary_field_stage: CallablePythonRuleStage = primary_rules.constructor_rules.field_constructor_issues
        self._primary_dynamic_stage: CallablePythonRuleStage = primary_rules.dynamic_type_rules.issues
        self._primary_branch_count: CallablePythonRuleStage = primary.branch_count_issues
        self._primary_prepare: CallablePythonPrepare = primary.prepare
        self._call_rules: PythonCallRulesContract = primary_rules.call_rules
        self._global_issue_collector: PythonGlobalIssueCollectorContract = PythonGlobalIssueCollector(context)
        self._phase_timings = {}
        self._execution_plan = PythonCodingIssueExecutionPlan(
            structure_state.source_nodes,
            [
                *primary.stages(),
                self._simple_stages.shape_issues,
                self._primary_dynamic_stage,
                self._simple_stages.property_issues,
                self._simple_stages.exception_issues,
                self._control_flow.conditional_issues,
                self._control_flow.elif_issues,
                self._control_flow.walrus_issues,
                self._field_mutations.collect_mutations,
                self._union_rules.conditional_type_issues,
                self._union_rules.annotation_issues,
                self._unnecessary_undefined_check.collect_checks,
                self._array_state_rules.collect_array_rules,
                self._simple_stages.subtest_issues,
                self._primary_field_stage,
            ],
            self._proxy_analyzer,
        )

    def execution_plan(self) -> PythonCodingIssueExecutionPlanContract:
        """Responsibilities: _AST rule execution inputs_."""
        return self._execution_plan

    def prepare(self) -> None:
        """Responsibilities: _Python rule state preparation_."""
        self._phase_timings.clear()
        with self._measure_phase("prepare.node-index"):
            nodes = self._context.node_index().nodes(self._context.tree())
        with self._measure_phase("prepare.container-aliases"):
            self._prepare_container_aliases(nodes)
        with self._measure_phase("prepare.primary-rules"):
            self._primary_prepare(self._context.tree())

    def phase_timings(self) -> dict[str, float]:
        """Responsibilities: _rule analysis timing access_."""
        return dict(self._phase_timings.items())

    def global_issues(self) -> list[JsonObject]:
        """Responsibilities: _global Python rule analysis_."""
        if type(self._context.tree()) is not ast.Module:
            raise TypeError("Python issue collection requires a module tree")
        with self._measure_phase("global-issues.module-types"):
            issues = self._module_type_issues()
        issues.extend(self._global_rule_issues())
        return issues

    def precedence_issues(self, node: ast.AST) -> list[JsonObject]:
        """Responsibilities: _Python operator precedence analysis_."""
        issues = self._python_operator_precedence.mixed_boolean_operator(node)
        issues.extend(self._python_operator_precedence.mixed_arithmetic_operator(node))
        return issues
