from __future__ import annotations

from functools import cached_property
from typing import Any, Callable
from implementation.ast.callable_statements import CallableStatements
from implementation.rules.call_rules import CallRules
from implementation.rules.constructor_rules import ConstructorRules
from implementation.rules.control_flow_issues import PythonControlFlowIssues
from implementation.rules.default_parameter_issues import PythonDefaultParameterIssues
from implementation.rules.type_rules import TypeRules
from implementation.rules.union_rules import UnionRules
from implementation.rules.field_mutation_collector import PythonFieldMutationCollector
from implementation.rules.proxy_callable_analyzer import PythonProxyCallableAnalyzer
from implementation.rules.unnecessary_undefined_check import (
    PythonUnnecessaryUndefinedCheck,
)
from implementation.rules.single_item_array_state.single_item_array_state import (
    PythonSingleItemArrayStateRules,
)
import ast

from implementation.rules.constants import SPECIAL_NAMES
from implementation.ast.protocols import PythonAstNodeIndexProtocol
from implementation.types import JsonObject
from implementation.references.unbounded_type_rules import PythonUnboundedTypeRules
from implementation.rules.single_item_array_state.operator_precedence import (
    PythonOperatorPrecedence,
)


class PythonCodingIssueCollector:
    """Responsibilities: _collection Python coding issues_."""

    def _handler_issues(self, handler: ast.ExceptHandler) -> list[JsonObject]:
        """Responsibilities: _exception-handler issues collection_."""
        issues: list[JsonObject] = []
        broad: Any = handler.type is None
        if not broad and type(handler.type) is ast.Name:
            broad = handler.type.id == "Exception"
        if broad:
            issues.append({"line": handler.lineno - 1, "kind": "broad-except"})
        if type(handler.type) is ast.Tuple and len(handler.type.elts) > 1:
            issues.append({"line": handler.lineno - 1, "kind": "python-multi-except"})
        return issues

    def _try_issues(self, node: ast.AST) -> list[JsonObject]:
        """Responsibilities: _try-statement issues collection_."""
        if type(node) is not ast.Try:
            return []
        issues: list[JsonObject] = []
        for handler in node.handlers:
            issues.extend(self._handler_issues(handler))
        return issues

    def _shape_issues(self, node: ast.AST) -> list[JsonObject]:
        """Responsibilities: _multiple-result-shape issues collection_."""
        is_special: Any = False
        if type(node) is ast.Name:
            is_special: Any = node.id in SPECIAL_NAMES
        else:
            if type(node) is ast.Attribute:
                is_special: Any = node.attr in SPECIAL_NAMES
        if not is_special:
            return []
        return [{"line": node.lineno - 1, "kind": "multiple-result-shapes"}]

    def _dynamic_issues(self, node: ast.AST) -> list[JsonObject]:
        """Responsibilities: _dynamic-type issues collection_."""
        value: Any = ast.Constant(value=None)
        if type(node) is ast.Assign:
            value: Any = node.value
        if type(node) is ast.AnnAssign and node.value is not None:
            value: Any = node.value
        if type(value) is ast.Call and type(value.func) is ast.Name:
            if value.func.id == "type":
                return [{"line": node.lineno - 1, "kind": "dynamic-type"}]
        return []

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
            if type(decorator) is ast.Name and decorator.id == "property":
                return [{"line": decorator.lineno - 1, "kind": "python-property"}]
        return []

    def _exception_issues(self, node: ast.AST) -> list[JsonObject]:
        """Responsibilities: _exception-raising issues collection_."""
        if type(node) is not ast.Raise:
            return []
        return [{"line": node.lineno - 1, "kind": "exception-raising"}]

    def _subtest_issues(self, node: ast.AST) -> list[JsonObject]:
        """Responsibilities: _subtest issues collection_."""
        if type(node) not in (ast.With, ast.AsyncWith):
            return []
        for item in node.items:
            context: Any = item.context_expr
            if type(context) is ast.Call:
                context = context.func
            if type(context) is not ast.Attribute:
                continue
            if context.attr != "subTest" or type(context.value) is not ast.Name:
                continue
            if context.value.id == "self":
                return [{"line": node.lineno - 1, "kind": "python-test-subtest"}]
        return []

    @cached_property
    def _stages(self) -> list[Callable[..., list[JsonObject]]]:
        """Responsibilities: _exposure ordered Python rule_."""
        return [
            self.constructor_rules.collect_constructor_issues,
            self.type_rules.collect_type_issues,
            self.type_rules.collect_generic_types,
            self._try_issues,
            self.call_rules.collect_call_issues,
            self._shape_issues,
            self._dynamic_issues,
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
            ast.AugAssign: (16,),
            ast.Try: (3,),
            ast.Call: (4, 11),
            ast.Name: (5,),
            ast.Attribute: (5, 11),
            ast.Match: (7,),
            ast.Assert: (9,),
            ast.Raise: (10,),
            ast.IfExp: (13,),
            ast.BoolOp: (13,),
            ast.If: (14, 17),
            ast.NamedExpr: (15,),
            ast.Compare: (18,),
            ast.Subscript: (19,),
            ast.With: (20,),
            ast.AsyncWith: (20,),
        }

    @cached_property
    def _stage_types(self) -> dict[type[ast.AST], tuple[int, ...]]:
        """Responsibilities: _combination AST node stage_."""
        stage_types = self._callable_stage_types.copy()
        stage_types.update(self._statement_stage_types)
        return stage_types

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
        self.type_rules: Any = TypeRules()
        self.call_rules: Any = CallRules(tree, node_index)
        self.union_rules: Any = UnionRules(tree, node_index)
        self.field_mutations: Any = PythonFieldMutationCollector(tree, node_index)
        self.proxy_analyzer: Any = PythonProxyCallableAnalyzer(tree)
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

    def collect(self) -> list[JsonObject]:
        """Responsibilities: _collection Python coding issues_."""
        target: Any = self.tree
        proxy_issues: list[JsonObject] = []
        issues: list[JsonObject] = self.unbounded_type_rules.issues()
        default_parameter = PythonDefaultParameterIssues(self.tree, self.node_index)
        issues.extend(default_parameter.issues())
        for node in self.node_index.nodes(target):
            proxy_issues.extend(self.proxy_analyzer.analyze(node))
            issues.extend(self.collect_node(node))
        return proxy_issues + issues

    def collect_node(self, node: ast.AST) -> list[JsonObject]:
        """Responsibilities: _collection issues Python AST_."""
        issues: list[JsonObject] = []
        for index in self._stage_types.get(type(node), ()):
            issues.extend(self._stages[index](node))
        issues.extend(self.operator_precedence.mixed_boolean_operator(node))
        issues.extend(self.operator_precedence.mixed_arithmetic_operator(node))
        return issues
