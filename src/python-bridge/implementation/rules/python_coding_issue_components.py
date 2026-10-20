from __future__ import annotations

import ast
from collections.abc import Callable

from implementation.protocols import PythonProxyCallableAnalyzerContract
from implementation.ast.protocols import (
    PythonSubtestAliasesContract,
    PythonTestOrderDependencyContract,
)
from implementation.rules.protocols import (
    PythonCallRulesContract,
    PythonCodingIssueComponentContextContract,
    PythonCodingIssueStagesContract,
    PythonFieldMutationCollectorContract,
)
from implementation.rules.protocols import (
    PythonControlFlowIssuesContract,
    PythonOperatorPrecedenceContract,
    PythonPrimaryRulesContract,
)
from implementation.rules.protocols import (
    PythonSingleItemArrayStateRulesContract,
    PythonUnboundedTypeRulesContract,
    PythonIncompleteCacheKeyContract,
    PythonUnionRulesContract,
    PythonUnnecessaryUndefinedCheckContract,
)
from implementation.rules.python_default_parameter_issues import (
    PythonDefaultParameterIssues,
)
from implementation.rules.python_coding_issue_assembly import PythonCodingIssueAssembly
from implementation.rules.python_hidden_global_state_rules import (
    PythonHiddenGlobalStateRules,
)
from implementation.rules.control_flow.python_temporal_coupling import (
    PythonTemporalCoupling,
)
from implementation.rules.python_duplicate_error_translation import (
    PythonDuplicateErrorTranslation,
)
from implementation.rules.call_analysis.testing.python_unasserted_async_completion import (
    PythonUnassertedAsyncCompletion,
)
from implementation.rules.control_flow.python_retry_without_ownership import (
    PythonRetryWithoutOwnership,
)
from implementation.rules.cache.python_incomplete_cache_key import (
    PythonIncompleteCacheKey,
)
from implementation.references.aliases.python_container_alias_batch import (
    PythonContainerAliasBatch,
)
from implementation.types import JsonObject

PythonRuleStage = Callable[[ast.AST], list[JsonObject]]
PythonProxyAnalysis = Callable[[ast.AST], list[JsonObject]]


class PythonCodingIssueComponents:
    """Responsibilities: _source analysis preparation_, _rule issue aggregation_."""

    context: PythonCodingIssueComponentContextContract
    union_rules: PythonUnionRulesContract
    field_mutations: PythonFieldMutationCollectorContract
    proxy_analyzer: PythonProxyCallableAnalyzerContract
    subtest_aliases: PythonSubtestAliasesContract
    unnecessary_undefined_check: PythonUnnecessaryUndefinedCheckContract
    array_state_rules: PythonSingleItemArrayStateRulesContract
    unbounded_type_rules: PythonUnboundedTypeRulesContract
    control_flow: PythonControlFlowIssuesContract
    python_operator_precedence: PythonOperatorPrecedenceContract
    simple_stages: PythonCodingIssueStagesContract
    _source_nodes: list[ast.AST]
    proxy_analysis: PythonProxyAnalysis
    test_order_dependency: PythonTestOrderDependencyContract
    incomplete_cache_key: PythonIncompleteCacheKeyContract

    def _collection_rule_issues(self, tree: ast.Module) -> list[JsonObject]:
        """Responsibilities: _Python collection rules_."""
        issues: list[JsonObject] = []
        hidden_global_state = PythonHiddenGlobalStateRules(self.context.node_index)
        issues.extend(hidden_global_state.issues(tree))
        return issues

    def _state_rule_issues(self, tree: ast.Module) -> list[JsonObject]:
        """Responsibilities: _Python state rules_."""
        issues: list[JsonObject] = []
        temporal_coupling = PythonTemporalCoupling(self.context.node_index)
        issues.extend(temporal_coupling.issues(tree))
        duplicate_errors = PythonDuplicateErrorTranslation(self.context.node_index)
        issues.extend(duplicate_errors.issues(tree))
        async_completion = PythonUnassertedAsyncCompletion(self.context.node_index)
        issues.extend(async_completion.issues(tree))
        retry = PythonRetryWithoutOwnership(self.context.node_index)
        issues.extend(retry.issues(tree))
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
        self.union_rules: PythonUnionRulesContract = type_state.union_rules
        self.field_mutations: PythonFieldMutationCollectorContract = (
            boundary_state.field_mutations
        )
        self.proxy_analyzer: PythonProxyCallableAnalyzerContract = (
            boundary_state.proxy_analyzer
        )
        self.subtest_aliases: PythonSubtestAliasesContract = (
            structure_state.subtest_aliases
        )
        self.unnecessary_undefined_check: PythonUnnecessaryUndefinedCheckContract = (
            boundary_state.unnecessary_undefined_check
        )
        self.array_state_rules: PythonSingleItemArrayStateRulesContract = (
            bundle.array_state_rules
        )
        self.unbounded_type_rules: PythonUnboundedTypeRulesContract = (
            type_state.unbounded_type_rules
        )
        self.control_flow: PythonControlFlowIssuesContract = (
            structure_state.control_flow
        )
        self.python_operator_precedence: PythonOperatorPrecedenceContract = (
            structure_state.python_operator_precedence
        )
        self.simple_stages: PythonCodingIssueStagesContract = (
            structure_state.simple_stages
        )
        self._source_nodes: list[ast.AST] = structure_state.source_nodes
        self.proxy_analysis: PythonProxyAnalysis = self.proxy_analyzer.analyze
        self.context: PythonCodingIssueComponentContextContract = context
        self.test_order_dependency: PythonTestOrderDependencyContract = (
            structure_state.test_order_dependency
        )
        self.primary_stages: list[PythonRuleStage] = primary.stages()
        self.primary_field_stage: PythonRuleStage = (
            primary.constructor_rules.field_constructor_issues
        )
        self.primary_dynamic_stage: PythonRuleStage = primary.dynamic_type_rules.issues
        self.primary_branch_count: Callable[[ast.AST], list[JsonObject]] = (
            primary.branch_count_issues
        )
        self.primary_prepare: Callable[[ast.AST], None] = primary.prepare
        self.call_rules: PythonCallRulesContract = primary.call_rules
        self.incomplete_cache_key: PythonIncompleteCacheKeyContract = (
            PythonIncompleteCacheKey(context.node_index)
        )

    def source_nodes(self) -> list[ast.AST]:
        """Responsibilities: _source node access_."""
        return self._source_nodes

    def rule_stages(self) -> list[PythonRuleStage]:
        """Responsibilities: _ordered Python rule stages_."""
        return [
            *self.primary_stages,
            self.simple_stages.shape_issues,
            self.primary_dynamic_stage,
            self.simple_stages.property_issues,
            self.call_rules.assertion_issues,
            self.simple_stages.exception_issues,
            self.call_rules.temporary_access_issues,
            self.call_rules.special_method_issues,
            self.control_flow.conditional_issues,
            self.control_flow.elif_issues,
            self.control_flow.walrus_issues,
            self.field_mutations.collect_mutations,
            self.union_rules.collect_union_issues,
            self.unnecessary_undefined_check.collect_checks,
            self.array_state_rules.collect_array_rules,
            self.simple_stages.subtest_issues,
            self.primary_field_stage,
        ]

    def prepare(self) -> None:
        """Responsibilities: _Python rule state preparation_."""
        nodes = self.context.node_index.nodes(self.context.tree)
        container_alias_batch = PythonContainerAliasBatch(
            [
                self.context.simple_container_aliases,
                self.context.subtest_container_aliases,
                self.context.union_container_aliases,
                self.context.field_container_aliases,
            ]
        )
        container_alias_batch.observe_all(nodes, self.context.tree)
        self.field_mutations.prepare_parent_index()
        self.primary_prepare(self.context.tree)

    def global_issues(self) -> list[JsonObject]:
        """Responsibilities: _global Python rule analysis_."""
        issues = self.unbounded_type_rules.issues()
        default_parameter = PythonDefaultParameterIssues(
            self.context.tree, self.context.node_index
        )
        issues.extend(default_parameter.issues())
        issues.extend(self.test_order_dependency.issues())
        issues.extend(self.primary_branch_count(self.context.tree))
        tree = self.context.tree
        issues.extend(self._collection_rule_issues(tree))
        issues.extend(self._state_rule_issues(tree))
        issues.extend(self.incomplete_cache_key.issues(tree))
        return issues

    def precedence_issues(self, node: ast.AST) -> list[JsonObject]:
        """Responsibilities: _Python operator precedence analysis_."""
        issues = self.python_operator_precedence.mixed_boolean_operator(node)
        issues.extend(self.python_operator_precedence.mixed_arithmetic_operator(node))
        return issues
