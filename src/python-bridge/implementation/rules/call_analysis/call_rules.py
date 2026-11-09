from __future__ import annotations

import ast
from dataclasses import dataclass
from time import perf_counter
from typing import cast

from implementation.ast.protocols import (
    PythonAstNodeIndexContract,
    PythonCallableConditionContextContract,
)
from implementation.protocols import (
    PythonCallAliasStateContract,
    PythonCallClassificationContract,
    PythonCallReflectionIndexContract,
    PythonTemporaryResultAccessContract,
)
from implementation.references.protocols import (
    PythonReferenceAliasesContract,
)
from implementation.rules.call_analysis.python_implementation_downcast import (
    PythonImplementationDowncast,
)
from implementation.rules.call_analysis.python_temporary_result_access import (
    PythonTemporaryResultAccess,
)
from implementation.rules.call_analysis.reflection.python_call_reflection_index import (
    PythonCallReflectionIndex,
)
from implementation.rules.call_analysis.testing.protocols import (
    PythonTestTimeDependencyContract,
)
from implementation.rules.call_analysis.testing.python_test_time_dependency import (
    PythonTestTimeDependency,
)
from implementation.rules.constants import (
    CALLABLE_FEATURE_DETECTION_RULE,
    PROTOCOL_DOWNCAST_PREPARE_TIMING,
    PROTOCOL_DOWNCAST_TIMING,
    PYTHON_ASSERTION_IN_TEST_RULE,
    PYTHON_ASSERTION_OUTSIDE_TEST_RULE,
    PYTHON_CALL_METHOD,
    PYTHON_CALL_METHOD_RULE,
    PYTHON_CALLABLE_FUNCTION,
    PYTHON_DIRECT_CLASS_INIT_RULE,
    PYTHON_ISINSTANCE_FUNCTION,
    PYTHON_OBJECT_SETATTR_RULE,
    PYTHON_TEMPORARY_RESULT_RULE,
    PYTHON_TEST_ASSERTION_RULE,
)
from implementation.rules.protocols import (
    PythonDowncastAnalysisContract,
)
from implementation.types import JsonObject, PythonASTLocatedNode


@dataclass
class CallRulesOptions:
    """Responsibilities: _invocation syntax_, _reflection aliases_."""

    tree: ast.AST
    node_index: PythonAstNodeIndexContract
    container_aliases: PythonCallAliasStateContract
    reference_aliases: PythonReferenceAliasesContract
    python_call_classification: PythonCallClassificationContract
    callable_condition_context: PythonCallableConditionContextContract


class CallRules:
    """Responsibilities: _invocation aliases_, _reflection rules_."""

    def _callable_issue(self, node: ast.Call) -> list[JsonObject]:
        """Responsibilities: _callable feature detection_."""
        if not self._callable_condition_context.contains_callable_condition(node):
            return []
        return [{"line": node.lineno - 1, "kind": CALLABLE_FEATURE_DETECTION_RULE}]

    def _reflection_issue(self, node: ast.Call, name: str) -> list[JsonObject]:
        """Responsibilities: _reflection call diagnostic_."""
        if name == PYTHON_CALLABLE_FUNCTION:
            return self._callable_issue(node)
        if name == PYTHON_ISINSTANCE_FUNCTION:
            if self._callable_condition_context.test_function(node):
                return []
            downcast_issues = self._protocol_downcast_issues(node)
            if downcast_issues:
                return downcast_issues
            name = f"python-{name}"
        return [{"line": node.lineno - 1, "kind": name}]

    def _protocol_downcast_issues(self, downcast_candidate: ast.Call) -> list[JsonObject]:
        """Responsibilities: _protocol downcast analysis timing_."""
        started = perf_counter()
        protocol_issue = self._protocol_downcast.issue(downcast_candidate)
        elapsed_ms = (perf_counter() - started) * 1000
        previous_duration = self._timings.get(PROTOCOL_DOWNCAST_TIMING, 0.0)
        self._timings[PROTOCOL_DOWNCAST_TIMING] = previous_duration + elapsed_ms
        if protocol_issue:
            return [protocol_issue]
        return []

    def _classify_call_kind(self, invocation: ast.Call) -> str:
        """Responsibilities: _call alias classification_."""
        function = invocation.func
        if type(function) is ast.Subscript:
            resolved = self._container_aliases.container_value(function)
            if resolved.found():
                kind = self._python_call_classification.resolved_kind(
                    invocation,
                    resolved.expression_node(),
                )
                if kind:
                    return kind
        return self._python_call_classification.kind(invocation)

    def _call_kind(self, invocation: ast.Call) -> str:
        """Responsibilities: _call classification timing_."""
        started = perf_counter()
        kind = self._classify_call_kind(invocation)
        elapsed_ms = (perf_counter() - started) * 1000
        for rule_id in (PYTHON_DIRECT_CLASS_INIT_RULE, PYTHON_OBJECT_SETATTR_RULE):
            name = f"rule.{rule_id}"
            self._timings[name] = self._timings.get(name, 0.0) + elapsed_ms
        return kind

    def _call_issues(self, source_node: ast.Call) -> list[JsonObject]:
        """Responsibilities: _Python call-specific diagnostics_."""
        kind = self._call_kind(source_node)
        if kind:
            return [{"line": cast(PythonASTLocatedNode, source_node).lineno - 1, "kind": kind}]
        time_issues = self._test_time_dependency.issue(
            source_node,
            self._callable_condition_context,
        )
        if time_issues:
            return time_issues
        name = self._reflection_names.resolve(source_node.func)
        if not name:
            return []
        return self._reflection_issue(source_node, name)

    def _assertion_issues(self, assertion: ast.Assert) -> list[JsonObject]:
        """Responsibilities: _assertion rule diagnostics_."""
        started = perf_counter()
        assertion_kind = PYTHON_ASSERTION_IN_TEST_RULE
        if not self._callable_condition_context.test_function(assertion):
            assertion_kind = PYTHON_ASSERTION_OUTSIDE_TEST_RULE
        issues: list[JsonObject] = [
            {"line": assertion.lineno - 1, "kind": PYTHON_TEST_ASSERTION_RULE},
            {"line": assertion.lineno - 1, "kind": assertion_kind},
        ]
        elapsed_ms = (perf_counter() - started) * 1000
        name = f"rule.{PYTHON_TEST_ASSERTION_RULE}"
        self._timings[name] = self._timings.get(name, 0.0) + elapsed_ms
        return issues

    def _call_method_issues(self, callable_node: ast.AST) -> list[JsonObject]:
        """Responsibilities: _call method diagnostics_."""
        started = perf_counter()
        issues: list[JsonObject] = []
        if type(callable_node) is not ast.FunctionDef and type(callable_node) is not ast.AsyncFunctionDef:
            elapsed_ms = (perf_counter() - started) * 1000
            name = f"rule.{PYTHON_CALL_METHOD_RULE}"
            self._timings[name] = self._timings.get(name, 0.0) + elapsed_ms
            return issues
        if callable_node.name == PYTHON_CALL_METHOD:
            issues.append({"line": callable_node.lineno - 1, "kind": PYTHON_CALL_METHOD_RULE})
        elapsed_ms = (perf_counter() - started) * 1000
        name = f"rule.{PYTHON_CALL_METHOD_RULE}"
        self._timings[name] = self._timings.get(name, 0.0) + elapsed_ms
        return issues

    def _time_downcast_prepare(self) -> None:
        """Responsibilities: _protocol downcast preparation timing_."""
        started = perf_counter()
        self._protocol_downcast.prepare()
        elapsed_ms = (perf_counter() - started) * 1000
        self._timings[PROTOCOL_DOWNCAST_PREPARE_TIMING] = (
            self._timings.get(PROTOCOL_DOWNCAST_PREPARE_TIMING, 0.0) + elapsed_ms
        )

    def __init__(self, options: CallRulesOptions) -> None:
        """Responsibilities: _rule state setup_."""
        self._tree: ast.AST = options.tree
        self._node_index: PythonAstNodeIndexContract = options.node_index
        self._container_aliases: PythonCallAliasStateContract = options.container_aliases
        self._python_call_classification: PythonCallClassificationContract = options.python_call_classification
        self._callable_condition_context: PythonCallableConditionContextContract = options.callable_condition_context
        self._temporary_result_access: PythonTemporaryResultAccessContract = PythonTemporaryResultAccess(
            options.reference_aliases,
            options.node_index,
        )
        self._protocol_downcast: PythonDowncastAnalysisContract = PythonImplementationDowncast(
            self._tree,
            self._node_index,
        )
        self._reflection_names: PythonCallReflectionIndexContract = PythonCallReflectionIndex(
            self._container_aliases,
            options.reference_aliases,
        )
        self._test_time_dependency: PythonTestTimeDependencyContract = PythonTestTimeDependency(
            options.reference_aliases,
        )
        self._timings: dict[str, float] = {}

    def timings_data(self) -> dict[str, float]:
        """Responsibilities: _protocol downcast timing access_."""
        timings = dict(self._timings.items())
        for name in (
            PROTOCOL_DOWNCAST_TIMING,
            PROTOCOL_DOWNCAST_PREPARE_TIMING,
            f"rule.{PYTHON_TEST_ASSERTION_RULE}",
        ):
            timings.setdefault(name, 0.0)
        return timings

    def configure_reflection(self) -> None:
        """Responsibilities: _reflection alias resolution_."""
        self._time_downcast_prepare()
        if type(self._tree) is not ast.Module:
            return
        nodes = self._node_index.nodes(self._tree)
        self._reflection_names.configure(self._tree, nodes)

    def issues(self, source_node: ast.AST) -> list[JsonObject]:
        """Responsibilities: _source node rule diagnostics_."""
        issues: list[JsonObject] = []
        if type(source_node) is ast.Assert:
            issues.extend(self._assertion_issues(source_node))
        issues.extend(self._call_method_issues(source_node))
        if self._temporary_result_access.violates(source_node):
            issues.append(
                {
                    "line": cast(PythonASTLocatedNode, source_node).lineno - 1,
                    "kind": PYTHON_TEMPORARY_RESULT_RULE,
                },
            )
        if type(source_node) is ast.Call:
            issues.extend(self._call_issues(source_node))
        return issues
