from __future__ import annotations

import ast
from dataclasses import dataclass
from typing import Any

from implementation.ast.protocols import PythonAstNodeIndexContract
from implementation.protocols import (
    PythonCallAliasStateContract,
    PythonCallClassificationContract,
    PythonTemporaryResultAccessContract,
)
from implementation.ast.protocols import PythonCallableConditionContextContract
from implementation.references.protocols import (
    PythonReferenceAliasesContract,
)
from implementation.rules.call_analysis.python_call_alias_state import (
    PythonCallAliasState,
)
from implementation.rules.call_analysis.testing.python_test_time_dependency import (
    PythonTestTimeDependency,
)
from implementation.rules.call_analysis.python_temporary_result_access import (
    PythonTemporaryResultAccess,
)
from implementation.rules.constants import (
    ALL_REFLECTION_CALLS,
    CALLABLE_FEATURE_DETECTION_RULE,
    PYTHON_ASSERTION_IN_TEST_RULE,
    PYTHON_ASSERTION_OUTSIDE_TEST_RULE,
    PYTHON_BUILTINS_MODULE,
    PYTHON_CALL_METHOD,
    PYTHON_CALLABLE_FUNCTION,
    PYTHON_CALL_METHOD_RULE,
    PYTHON_ISINSTANCE_FUNCTION,
    PYTHON_TEMPORARY_RESULT_RULE,
    PYTHON_TEST_ASSERTION_RULE,
    REFLECTION_CALLS,
)
from implementation.types import JsonObject


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

    def _alias_name(self, name: str, names: frozenset[str]) -> str:
        """Responsibilities: _alias reflection target_."""
        if name in names:
            return name
        direct_name = self.reflection_aliases.get(name, "")
        if direct_name in names:
            return direct_name
        return self.reference_aliases.resolved_name(name, names)

    def _builtin_name(self, value: ast.AST) -> str:
        """Responsibilities: _builtin reflection identity_."""
        if type(value) is ast.Subscript:
            resolved = self.container_aliases.container_value(value)
            if resolved.found():
                return self._builtin_name(resolved.expression_node())
            return ""
        if type(value) is ast.Name:
            if value.id in REFLECTION_CALLS:
                return value.id
            return ""
        if type(value) is ast.Attribute and type(value.value) is ast.Name:
            if value.value.id in self.module_names and value.attr in REFLECTION_CALLS:
                return value.attr
        return ""

    def _mapped_function_name(self, function: ast.AST, names: frozenset[str]) -> str:
        """Responsibilities: _reflection callable identity_."""
        if type(function) is ast.Subscript:
            resolved = self.container_aliases.container_value(function)
            if resolved.found():
                return self._mapped_function_name(resolved.expression_node(), names)
            return ""
        if type(function) is ast.Name:
            return self._named_function_name(function, names)
        if type(function) is ast.Attribute and type(function.value) is ast.Name:
            if function.value.id not in self.module_names:
                return ""
            if function.attr in names:
                return function.attr
        return ""

    def _named_function_name(self, function: ast.Name, names: frozenset[str]) -> str:
        """Responsibilities: _named callable alias resolution_."""
        resolved = self.container_aliases.named_value(function.id)
        if resolved.found():
            return self._mapped_function_name(resolved.expression_node(), names)
        return self._alias_name(function.id, names)

    def _assignment_values(self, node: ast.AST) -> dict[str, ast.AST]:
        """Responsibilities: _reflection assignment targets_."""
        values: dict[str, ast.AST] = {}
        if type(node) is ast.Assign:
            for target in node.targets:
                values.update(
                    self.reference_aliases.target_values(target, node.value, False)
                )
        if type(node) is ast.AnnAssign and node.value is not None:
            values.update(
                self.reference_aliases.target_values(node.target, node.value, False)
            )
        return values

    def _observe_reflection_node(self, node: ast.AST) -> None:
        """Responsibilities: _reflection import observation_."""
        if type(node) is ast.ImportFrom and node.module == PYTHON_BUILTINS_MODULE:
            for imported in node.names:
                if imported.name in ALL_REFLECTION_CALLS:
                    self.reflection_aliases[imported.asname or imported.name] = (
                        imported.name
                    )
        if type(node) is ast.Import:
            for imported in node.names:
                if imported.name == PYTHON_BUILTINS_MODULE:
                    self.module_names.add(imported.asname or imported.name)
        self.container_aliases.observe(node)

    def _reset_reflection(self) -> None:
        """Responsibilities: _reflection state reset_."""
        self.reflection_aliases.clear()
        self.module_names.clear()
        self.module_names.add(PYTHON_BUILTINS_MODULE)
        self.container_aliases.aliases.clear()
        self.container_aliases.names.clear()
        self.reference_aliases.collect(self.tree)

    def _resolve_reflection_assignments(self, nodes: list[ast.AST]) -> None:
        """Responsibilities: _reflection assignment resolution_."""
        for node in nodes:
            for target, value in self._assignment_values(node).items():
                name = self._builtin_name(value)
                if name:
                    self.reflection_aliases[target] = name

    def _reflection_issues(self, node: ast.AST) -> list[JsonObject]:
        """Responsibilities: _reflection violation collection_."""
        if type(node) is not ast.Call:
            return []
        name = self._mapped_function_name(node.func, REFLECTION_CALLS)
        if not name:
            return []
        if name == PYTHON_CALLABLE_FUNCTION:
            if not self.callable_condition_context.contains_callable_condition(node):
                return []
            return [{"line": node.lineno - 1, "kind": CALLABLE_FEATURE_DETECTION_RULE}]
        if name == PYTHON_ISINSTANCE_FUNCTION:
            name = f"python-{name}"
        return [{"line": node.lineno - 1, "kind": name}]

    def __init__(self, options: CallRulesOptions) -> None:
        """Responsibilities: _rule state setup_."""
        self.tree: Any = options.tree
        self.node_index: Any = options.node_index
        self.container_aliases: PythonCallAliasState = options.container_aliases
        self.python_call_classification: PythonCallClassificationContract = (
            options.python_call_classification
        )
        self.callable_condition_context: PythonCallableConditionContextContract = (
            options.callable_condition_context
        )
        self.temporary_result_access: PythonTemporaryResultAccessContract = (
            PythonTemporaryResultAccess(options.reference_aliases, options.node_index)
        )
        self.test_time_dependency: PythonTestTimeDependency = PythonTestTimeDependency(
            options.reference_aliases
        )
        self.reference_aliases: PythonReferenceAliasesContract = (
            options.reference_aliases
        )
        self.reflection_aliases: dict[str, str] = {}
        self.module_names: set[str] = {PYTHON_BUILTINS_MODULE}

    def configure_reflection(self) -> None:
        """Responsibilities: _reflection alias resolution_."""
        self._reset_reflection()
        if type(self.tree) is not ast.Module:
            return
        nodes = self.node_index.nodes(self.tree)
        for node in nodes:
            self._observe_reflection_node(node)
        self._resolve_reflection_assignments(nodes)

    def assertion_issues(self, node: ast.AST) -> list[JsonObject]:
        """Responsibilities: _bare assertion reporting_."""
        if type(node) is not ast.Assert:
            return []
        if self.callable_condition_context.test_function(node):
            return [
                {"line": node.lineno - 1, "kind": PYTHON_TEST_ASSERTION_RULE},
                {"line": node.lineno - 1, "kind": PYTHON_ASSERTION_IN_TEST_RULE},
            ]
        return [
            {"line": node.lineno - 1, "kind": PYTHON_TEST_ASSERTION_RULE},
            {"line": node.lineno - 1, "kind": PYTHON_ASSERTION_OUTSIDE_TEST_RULE},
        ]

    def collect_call_issues(self, node: ast.AST) -> list[JsonObject]:
        """Responsibilities: _special invocation collection_."""
        kind = self.python_call_classification.kind(node)
        if kind:
            return [{"line": node.lineno - 1, "kind": kind}]
        time_issue = self.test_time_dependency.issue(
            node, self.callable_condition_context
        )
        if time_issue:
            return time_issue
        return self._reflection_issues(node)

    def special_method_issues(self, node: ast.AST) -> list[JsonObject]:
        """Responsibilities: _special method reporting_."""
        if type(node) in (ast.FunctionDef, ast.AsyncFunctionDef):
            if node.name == PYTHON_CALL_METHOD:
                return [{"line": node.lineno - 1, "kind": PYTHON_CALL_METHOD_RULE}]
        return []

    def temporary_access_issues(self, node: ast.AST) -> list[JsonObject]:
        """Responsibilities: _temporary access reporting_."""
        if not self.temporary_result_access.violates(node):
            return []
        return [{"line": node.lineno - 1, "kind": PYTHON_TEMPORARY_RESULT_RULE}]
