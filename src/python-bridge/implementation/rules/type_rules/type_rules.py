from __future__ import annotations

import ast
from time import perf_counter

from implementation.protocols import (
    PythonTupleTypeNamesContract,
    PythonTypeFactoryNamesContract,
)
from implementation.rules.constants import (
    PYTHON_CLASS_METHOD_RULE,
    PYTHON_STATIC_METHOD_RULE,
    PYTHON_TUPLE_TYPE_RULE,
)
from implementation.rules.protocols import (
    PythonDecoratorAliasStateContract,
    PythonDecoratorRuleContract,
)
from implementation.rules.type_rules.protocols import (
    PythonDeclaredAnnotationIssuesContract,
    PythonTypeFactoryIssuesContract,
    TypeRulesOptionsContract,
)
from implementation.rules.type_rules.python_declared_annotation_issues import (
    PythonDeclaredAnnotationIssues,
)
from implementation.rules.type_rules.python_type_cast_issues import PythonTypeCastIssues
from implementation.rules.type_rules.python_type_factory_issues import (
    PythonTypeFactoryIssues,
)
from implementation.types import JsonObject, PythonCallableAstNode


class TypeRules:
    """Responsibilities: _type rule coordination_, _decorator issue collection_."""

    _decorator_rules: PythonDecoratorRuleContract
    _decorator_aliases: PythonDecoratorAliasStateContract
    _type_factory_names: PythonTypeFactoryNamesContract
    _type_factory_issues: PythonTypeFactoryIssuesContract
    _type_cast_issues: PythonTypeCastIssues
    _declared_annotation_issues: PythonDeclaredAnnotationIssuesContract
    _timings: dict[str, float]

    def _record_rule_timings(self, rule_ids: list[str], started: float) -> None:
        """Responsibilities: _per-rule elapsed-time accumulation_."""
        elapsed_ms = (perf_counter() - started) * 1000
        for rule_id in rule_ids:
            name = f"rule.{rule_id}"
            self._timings[name] = self._timings.get(name, 0.0) + elapsed_ms

    def _type_node_issues(self, syntax_node: PythonCallableAstNode) -> list[JsonObject]:
        """Responsibilities: _type node rule analysis_, _per-rule timing_."""
        started = perf_counter()
        annotation_issues = self._declared_annotation_issues.issues(syntax_node)
        self._record_rule_timings([PYTHON_TUPLE_TYPE_RULE], started)
        started = perf_counter()
        kinds = self._decorator_rules.kinds(syntax_node)
        self._record_rule_timings([PYTHON_STATIC_METHOD_RULE, PYTHON_CLASS_METHOD_RULE], started)
        issues: list[JsonObject] = [{"line": syntax_node.lineno - 1, "kind": kind} for kind in kinds]
        issues.extend(annotation_issues)
        return issues

    def __init__(self, options: TypeRulesOptionsContract) -> None:
        """Responsibilities: _type rule analysis setup_."""
        self._tree: ast.AST = options.tree
        self._decorator_rules = options.decorator_rules
        self._decorator_aliases = options.decorator_aliases
        self._tuple_type_names: PythonTupleTypeNamesContract = options.tuple_type_names
        self._type_factory_names = options.type_factory_names
        self._type_factory_issues = PythonTypeFactoryIssues(self._type_factory_names, options.node_index)
        self._type_cast_issues = PythonTypeCastIssues()
        self._declared_annotation_issues = PythonDeclaredAnnotationIssues(
            options.tuple_type_names,
            options.node_index,
        )
        self._timings = {}

    def prepare(self) -> None:
        """Responsibilities: _type factory alias preparation_."""
        self._type_factory_names.configure(self._tree)
        self._type_cast_issues.configure(self._tree)
        self._tuple_type_names.configure(self._tree)

    def collect_type_issues(self, syntax_node: ast.AST) -> list[JsonObject]:
        """Responsibilities: _type issue aggregation_."""
        self._type_factory_names.observe(syntax_node)
        self._tuple_type_names.observe(syntax_node)
        self._decorator_aliases.observe(syntax_node)
        factory_issues = self._type_factory_issues.issues(syntax_node)
        factory_issues.extend(self._type_cast_issues.issues(syntax_node))
        match syntax_node:
            case ast.FunctionDef() | ast.AsyncFunctionDef():
                issues = self._type_node_issues(syntax_node)
            case ast.arg() | ast.AnnAssign():
                started = perf_counter()
                issues = self._declared_annotation_issues.issues(syntax_node)
                self._record_rule_timings([PYTHON_TUPLE_TYPE_RULE], started)
            case _:
                issues = []
        issues.extend(factory_issues)
        return issues

    def timings_data(self) -> dict[str, float]:
        """Responsibilities: _type rule timing access_."""
        return dict(self._timings.items())

    def collect_generic_types(self, callable_definition: ast.AST) -> list[JsonObject]:
        """Responsibilities: _callable generic issue collection_."""
        match callable_definition:
            case ast.FunctionDef() | ast.AsyncFunctionDef():
                return self._declared_annotation_issues.generic_issues(
                    callable_definition,
                )
            case _:
                return []
