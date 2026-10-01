from __future__ import annotations

from functools import cached_property
from typing import Any, Callable
from implementation.ast.callable_statements import CallableStatements
from implementation.rules.call_analysis.call_rules import CallRules
from implementation.rules.constructor_rules import ConstructorRules
from implementation.rules.python_syntax.decorator_rules import PythonDecoratorRules
from implementation.rules.python_syntax.dynamic_type_rules import PythonDynamicTypeRules
from implementation.rules.python_syntax.exception_rules import PythonExceptionRules
from implementation.rules.python_syntax.exception_alias_state import (
    PythonExceptionAliasState,
)
from implementation.rules.control_flow.control_flow_issues import (
    PythonControlFlowIssues,
)
from implementation.rules.default_parameter_issues import PythonDefaultParameterIssues
from implementation.rules.python_syntax.type_rules import TypeRules
from implementation.rules.union_rules import UnionRules
from implementation.rules.field_mutation_collector import PythonFieldMutationCollector
from implementation.rules.proxy_callable.proxy_callable_analyzer import (
    PythonProxyCallableAnalyzer,
)
from implementation.rules.unnecessary_undefined_check import (
    PythonUnnecessaryUndefinedCheck,
)
from implementation.rules.single_item_array_state.single_item_array_state import (
    PythonSingleItemArrayStateRules,
)
import ast
from time import perf_counter

from implementation.ast.protocols import PythonAstNodeIndexProtocol
from implementation.types import JsonObject
from implementation.references.unbounded_type_rules import PythonUnboundedTypeRules
from implementation.references.test_assertions.subtest_aliases import (
    PythonSubtestAliases,
)
from implementation.references.aliases.container_aliases import PythonContainerAliases
from implementation.references.aliases.protocols import PythonContainerAliasesProtocol
from implementation.references.aliases.container_keys import PythonContainerKeys
from implementation.rules.single_item_array_state.operator_precedence import (
    PythonOperatorPrecedence,
)
from coding_issue_timing import PythonCodingIssueTiming
from implementation.rules.coding_issue_stages import PythonCodingIssueStages
from implementation.rules.constants import STAGE_TYPES


PythonRuleStage = Callable[[ast.AST], list[JsonObject]]


class PythonCodingIssueCollector:
    """Responsibilities: _collection Python coding issues_."""

    @cached_property
    def _stages(self) -> list[PythonRuleStage]:
        """Responsibilities: _exposure ordered Python rule_."""
        return [
            self.constructor_rules.collect_constructor_issues,
            self.type_rules.collect_type_issues,
            self.type_rules.collect_generic_types,
            self.exception_rules.try_statement_issues,
            self.call_rules.collect_call_issues,
            self.simple_stages.shape_issues,
            self.dynamic_type_rules.issues,
            self.simple_stages.match_issues,
            self.simple_stages.property_issues,
            self.call_rules.assertion_issues,
            self.simple_stages.exception_issues,
            self.call_rules.temporary_instance_issues,
            self.call_rules.special_method_issues,
            self.control_flow.conditional_issues,
            self.control_flow.elif_issues,
            self.control_flow.walrus_issues,
            self.field_mutations.collect_mutations,
            self.union_rules.collect_union_issues,
            self.unnecessary_undefined_check.collect_checks,
            self.array_state_rules.collect_array_rules,
            self.simple_stages.subtest_issues,
        ]

    def _timed_stage(self, stage: PythonRuleStage, node: ast.AST) -> list[JsonObject]:
        """Responsibilities: _timed Python rule stage_."""
        started = perf_counter()
        issues = stage(node)
        stage_name = f"rule.{stage.__name__}"
        elapsed_ms = (perf_counter() - started) * 1000
        previous_ms = self.timings.get(stage_name, 0.0)
        self.timings[stage_name] = previous_ms + elapsed_ms
        return issues

    def _timed_precedence(self, node: ast.AST) -> list[JsonObject]:
        """Responsibilities: _timed operator precedence stage_."""
        started = perf_counter()
        issues = self.operator_precedence.mixed_boolean_operator(node)
        issues.extend(self.operator_precedence.mixed_arithmetic_operator(node))
        elapsed_ms = (perf_counter() - started) * 1000
        previous_ms = self.timings.get("rule.operator-precedence", 0.0)
        self.timings["rule.operator-precedence"] = previous_ms + elapsed_ms
        return issues

    def _prepare(self) -> None:
        """Responsibilities: _Python rule state preparation_."""
        self.container_aliases.observe_all(self.node_index.nodes(self.tree))
        self.field_mutations.prepare()
        self.decorator_rules.aliases.observe_module(self.tree)
        self.dynamic_type_rules.configure_imports(self.tree)
        self.exception_aliases.configure_imports(self.tree)
        self.call_rules._configure()

    def __init__(
        self,
        tree: ast.AST,
        source: str,
        node_index: PythonAstNodeIndexProtocol,
    ) -> None:
        """Responsibilities: _initialization Python coding issue_."""
        self.tree: Any = tree
        self.node_index: Any = node_index
        callable_statements: Any = CallableStatements()
        self.constructor_rules: Any = ConstructorRules()
        self.decorator_rules: PythonDecoratorRules = PythonDecoratorRules()
        self.dynamic_type_rules: PythonDynamicTypeRules = PythonDynamicTypeRules()
        self.exception_aliases: PythonExceptionAliasState = PythonExceptionAliasState()
        self.exception_rules: PythonExceptionRules = PythonExceptionRules(
            self.exception_aliases
        )
        self.type_rules: Any = TypeRules(tree, self.decorator_rules)
        self.call_rules: Any = CallRules(tree, node_index)
        self.union_rules: Any = UnionRules(tree, node_index)
        self.field_mutations: PythonFieldMutationCollector = (
            PythonFieldMutationCollector(tree, node_index)
        )
        self.proxy_analyzer: Any = PythonProxyCallableAnalyzer(tree)
        self.timing: PythonCodingIssueTiming = PythonCodingIssueTiming(
            self.proxy_analyzer.analyze, self.collect_node
        )
        self.timings: dict[str, float] = self.timing.timings
        self.subtest_aliases: PythonSubtestAliases = PythonSubtestAliases(
            tree, node_index
        )
        self.unnecessary_undefined_check: Any = PythonUnnecessaryUndefinedCheck(tree)
        self.array_state_rules: Any = PythonSingleItemArrayStateRules(tree, node_index)
        self.unbounded_type_rules: PythonUnboundedTypeRules = PythonUnboundedTypeRules(
            tree, node_index
        )
        self.control_flow: Any = PythonControlFlowIssues(
            tree,
            source.splitlines(),
            callable_statements.assignment_value_ids(tree, node_index),
            node_index,
        )
        self.operator_precedence: PythonOperatorPrecedence = PythonOperatorPrecedence(
            tree, source.splitlines(), node_index
        )
        self.container_aliases: PythonContainerAliasesProtocol = (
            PythonContainerAliases()
        )
        self.container_keys: PythonContainerKeys = PythonContainerKeys(
            self.container_aliases
        )
        self.simple_stages: PythonCodingIssueStages = PythonCodingIssueStages(
            self.container_keys, self.decorator_rules, self.subtest_aliases
        )

    def collect(self) -> list[JsonObject]:
        """Responsibilities: _collection Python coding issues_."""
        self._prepare()
        target: Any = self.tree
        proxy_issues: list[JsonObject] = []
        issues: list[JsonObject] = self.unbounded_type_rules.issues()
        default_parameter = PythonDefaultParameterIssues(self.tree, self.node_index)
        issues.extend(default_parameter.issues())
        nodes = self.node_index.nodes(target)
        self.timing.collect(nodes, proxy_issues, issues)
        return proxy_issues + issues

    def collect_node(self, node: ast.AST) -> list[JsonObject]:
        """Responsibilities: _collection issues Python AST_."""
        issues: list[JsonObject] = []
        for index in STAGE_TYPES.get(type(node), ()):
            issues.extend(self._timed_stage(self._stages[index], node))
        issues.extend(self._timed_precedence(node))
        return issues
