from __future__ import annotations

from functools import cached_property
from typing import Any, Callable
from implementation.ast.callable_statements import CallableStatements
from implementation.rules.call_analysis.call_rules import CallRules
from implementation.rules.constructor_rules import ConstructorRules
from implementation.rules.python_syntax.decorator_rules import PythonDecoratorRules
from implementation.rules.python_syntax.dynamic_type_rules import PythonDynamicTypeRules
from implementation.rules.python_syntax.exception_rules import PythonExceptionRules
from implementation.rules.python_syntax.exception_alias_state import PythonExceptionAliasState
from implementation.rules.control_flow.control_flow_issues import PythonControlFlowIssues
from implementation.rules.default_parameter_issues import PythonDefaultParameterIssues
from implementation.rules.python_syntax.type_rules import TypeRules
from implementation.rules.union_rules import UnionRules
from implementation.rules.field_mutation_collector import PythonFieldMutationCollector
from implementation.rules.proxy_callable.proxy_callable_analyzer import PythonProxyCallableAnalyzer
from implementation.rules.unnecessary_undefined_check import (
    PythonUnnecessaryUndefinedCheck,
)
from implementation.rules.single_item_array_state.single_item_array_state import (
    PythonSingleItemArrayStateRules,
)
import ast
from time import perf_counter

from implementation.rules.constants import SPECIAL_NAMES
from implementation.ast.protocols import PythonAstNodeIndexProtocol
from implementation.types import JsonObject
from implementation.references.unbounded_type_rules import PythonUnboundedTypeRules
from implementation.references.test_assertions.subtest_aliases import PythonSubtestAliases
from implementation.references.aliases.container_aliases import PythonContainerAliases
from implementation.references.aliases.protocols import PythonContainerAliasesProtocol
from implementation.references.aliases.container_keys import PythonContainerKeys
from implementation.rules.single_item_array_state.operator_precedence import (
    PythonOperatorPrecedence,
)
from coding_issue_timing import PythonCodingIssueTiming


PythonRuleStage = Callable[[ast.AST], list[JsonObject]]


class PythonCodingIssueCollector:
    """Responsibilities: _collection Python coding issues_."""

    def _shape_issues(self, node: ast.AST) -> list[JsonObject]:
        """Responsibilities: _multiple-result-shape issues collection_."""
        name = self._shape_name(node)
        if name not in SPECIAL_NAMES:
            return []
        return [{"line": node.lineno - 1, "kind": "multiple-result-shapes"}]

    def _shape_name(self, node: ast.AST) -> str:
        """Responsibilities: _special result shape name_."""
        if type(node) is ast.Name:
            return node.id
        if type(node) is ast.Attribute:
            return node.attr
        if type(node) is not ast.Subscript:
            return ""
        return self.container_keys.static_key(node.slice)

    def _match_issues(self, node: ast.AST) -> list[JsonObject]:
        """Responsibilities: _switch issues collection_."""
        if type(node) is not ast.Match:
            return []
        return [{"line": node.lineno - 1, "kind": "switch"}]

    def _property_issues(self, node: ast.AST) -> list[JsonObject]:
        """Responsibilities: _property issues collection_."""
        if type(node) not in (ast.FunctionDef, ast.AsyncFunctionDef):
            return []
        for decorator in node.decorator_list:
            if self.decorator_rules.property_decorator(decorator):
                return [{"line": decorator.lineno - 1, "kind": "python-property"}]
        return []

    def _exception_issues(self, node: ast.AST) -> list[JsonObject]:
        """Responsibilities: _exception-raising issues collection_."""
        if type(node) is not ast.Raise:
            return []
        return [{"line": node.lineno - 1, "kind": "exception-raising"}]

    def _subtest_issues(self, node: ast.AST) -> list[JsonObject]:
        """Responsibilities: _subtest issues collection_."""
        if not self.subtest_aliases.matches(node):
            return []
        return [{"line": node.lineno - 1, "kind": "python-test-subtest"}]

    @cached_property
    def _stages(self) -> list[Callable[..., list[JsonObject]]]:
        """Responsibilities: _exposure ordered Python rule_."""
        return [
            self.constructor_rules.collect_constructor_issues,
            self.type_rules.collect_type_issues,
            self.type_rules.collect_generic_types,
            self.exception_rules.try_statement_issues,
            self.call_rules.collect_call_issues,
            self._shape_issues,
            self.dynamic_type_rules.issues,
            self._match_issues,
            self._property_issues,
            self.call_rules.assertion_issues,
            self._exception_issues,
            self.call_rules.temporary_instance_issues,
            self.call_rules.special_method_issues,
            self.control_flow.conditional_issues,
            self.control_flow.elif_issues,
            self.control_flow.walrus_issues,
            self.field_mutations.collect_mutations,
            self.union_rules.collect_union_issues,
            self.unnecessary_undefined_check.collect_checks,
            self.array_state_rules.collect_array_rules,
            self._subtest_issues,
        ]

    @cached_property
    def _callable_stage_types(self) -> dict[type[ast.AST], tuple[int, ...]]:
        """Responsibilities: _callable nodes rule mapping_."""
        functions: Any = (0, 1, 2, 8, 12, 17)
        return {
            ast.FunctionDef: functions,
            ast.AsyncFunctionDef: functions,
            ast.ClassDef: (1,),
            ast.arg: (1, 17),
        }

    @cached_property
    def _statement_stage_types(self) -> dict[type[ast.AST], tuple[int, ...]]:
        """Responsibilities: _statement nodes rule mapping_."""
        assignments: Any = (1, 6, 16, 17)
        return {
            ast.Assign: assignments,
            ast.AnnAssign: assignments,
            ast.Return: (1, 6),
            ast.Expr: (1,),
            ast.Return: (6,),
            ast.AugAssign: (16,),
            ast.Try: (3,),
            ast.TryStar: (3,),
            ast.Call: (4, 11),
            ast.Name: (5,),
            ast.Attribute: (5, 11),
            ast.Subscript: (5, 19),
            ast.Match: (7,),
            ast.Assert: (9,),
            ast.Raise: (6, 10),
            ast.IfExp: (13,),
            ast.BoolOp: (13,),
			ast.If: (13, 14, 17),
            ast.NamedExpr: (15,),
            ast.Compare: (18,),
            ast.With: (20,),
            ast.AsyncWith: (20,),
        }

    @cached_property
    def _stage_types(self) -> dict[type[ast.AST], tuple[int, ...]]:
        """Responsibilities: _combination AST node stage_."""
        stage_types = self._callable_stage_types.copy()
        stage_types.update(self._statement_stage_types)
        return stage_types

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
        self.decorator_rules.configure_imports(self.tree)
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
        self.exception_rules: PythonExceptionRules = PythonExceptionRules(self.exception_aliases)
        self.type_rules: Any = TypeRules(tree, self.decorator_rules)
        self.call_rules: Any = CallRules(tree, node_index)
        self.union_rules: Any = UnionRules(tree, node_index)
        self.field_mutations: PythonFieldMutationCollector = PythonFieldMutationCollector(tree, node_index)
        self.proxy_analyzer: Any = PythonProxyCallableAnalyzer(tree)
        self.timing: PythonCodingIssueTiming = PythonCodingIssueTiming(
            self.proxy_analyzer.analyze, self.collect_node
        )
        self.timings: dict[str, float] = self.timing.timings
        self.subtest_aliases: PythonSubtestAliases = PythonSubtestAliases(tree, node_index)
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
        self.container_aliases: PythonContainerAliasesProtocol = PythonContainerAliases()
        self.container_keys: PythonContainerKeys = PythonContainerKeys(self.container_aliases)

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
        for index in self._stage_types.get(type(node), ()):
            issues.extend(self._timed_stage(self._stages[index], node))
        issues.extend(self._timed_precedence(node))
        return issues
