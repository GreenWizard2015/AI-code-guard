from __future__ import annotations

import ast

from implementation.rules.coding_issues.primary_rule_protocols import (
    PythonPrimaryRuleSetContract,
    PythonPrimaryRuleStateContract,
)
from implementation.rules.coding_issues.primary_rule_set import PythonPrimaryRuleState
from implementation.rules.constants import MAX_CALLABLE_BRANCHES
from implementation.rules.protocols import PythonCodingIssueComponentContextContract
from implementation.rules.type_rules.type_rules import TypeRules
from implementation.rules.type_rules.type_rules_options import TypeRulesOptions
from implementation.types import CallablePythonRuleStage, JsonObject


class PythonCodingIssuePrimaryRules:
    """Responsibilities: _rule stage composition_, _branch count preparation_."""

    _state: PythonPrimaryRuleStateContract
    _branch_counts: dict[ast.AST, int]
    _prepared_tree: ast.AST
    _callable_nodes: list[ast.AST]
    _callable_owners: dict[ast.AST, ast.AST]

    def _branch_count_node(self, current: ast.AST) -> int:
        """Responsibilities: _branch count_."""
        if type(current) in (
            ast.If,
            ast.For,
            ast.AsyncFor,
            ast.While,
            ast.IfExp,
            ast.Try,
        ):
            return 1
        if type(current) is ast.Match:
            return len(current.cases)
        return 0

    def _cache_owner_path(self, path: list[ast.AST], owner: ast.AST) -> ast.AST:
        """Responsibilities: _callable owner path compression_."""
        owner = self._callable_owners.setdefault(owner, owner)
        cached_path = dict.fromkeys(path, owner)
        self._callable_owners.update(cached_path)
        return owner

    def _callable_owner(self, node: ast.AST) -> ast.AST:
        """Responsibilities: _callable ownership_."""
        current = node
        path: list[ast.AST] = []
        while current not in self._callable_owners:
            if type(current) in (ast.FunctionDef, ast.AsyncFunctionDef, ast.Lambda):
                break
            parents = self._state.node_index.parents(current)
            if not parents:
                return node
            path.append(current)
            current = parents[0]
        return self._cache_owner_path(path, current)

    def _record_branch_count(self, owner: ast.AST, branch_count: int) -> None:
        """Responsibilities: _branch count recording_."""
        if type(owner) is not ast.FunctionDef and type(owner) is not ast.AsyncFunctionDef:
            return
        if branch_count:
            self._branch_counts.update({owner: self._branch_counts.get(owner, 0) + branch_count})

    def _callable_nodes_for(self, requested_tree: ast.AST) -> list[ast.AST]:
        """Responsibilities: _callable branch report targets_."""
        if requested_tree is self._prepared_tree:
            return self._callable_nodes
        return [
            node
            for node in self._state.node_index.nodes(requested_tree)
            if type(node) is ast.FunctionDef or type(node) is ast.AsyncFunctionDef
        ]

    def _prepare_branch_counts(self, analysis_tree: ast.AST) -> None:
        """Responsibilities: _branch count state preparation_."""
        self._branch_counts.clear()
        self._callable_nodes.clear()
        self._callable_owners.clear()
        self._prepared_tree = analysis_tree
        for node in self._state.node_index.nodes(analysis_tree):
            if type(node) is ast.FunctionDef or type(node) is ast.AsyncFunctionDef:
                self._callable_nodes.append(node)
            branch_count = self._branch_count_node(node)
            if branch_count:
                self._record_branch_count(self._callable_owner(node), branch_count)

    def _append_branch_issue(self, issues: list[JsonObject], node: ast.AST) -> None:
        """Responsibilities: _callable branch violation reporting_."""
        if type(node) is not ast.FunctionDef and type(node) is not ast.AsyncFunctionDef:
            return
        if self._branch_counts.get(node, 0) <= MAX_CALLABLE_BRANCHES:
            return
        issues.append(
            {
                "line": node.lineno - 1,
                "kind": "callable-branch-count",
                "name": node.name,
            },
        )

    def __init__(
        self,
        context: PythonCodingIssueComponentContextContract,
        rule_set: PythonPrimaryRuleSetContract,
    ) -> None:
        """Responsibilities: _primary Python rule construction_."""
        type_rules = TypeRules(
            TypeRulesOptions(
                context.tree(),
                context.node_index(),
                rule_set.decorator_rules,
                rule_set.decorator_aliases,
                rule_set.type_factory_names,
                rule_set.tuple_type_names,
            ),
        )
        self._state: PythonPrimaryRuleStateContract = PythonPrimaryRuleState(
            rule_set,
            type_rules,
            context.node_index(),
        )
        self._branch_counts: dict[ast.AST, int] = {}
        self._prepared_tree: ast.AST = context.tree()
        self._callable_nodes: list[ast.AST] = []
        self._callable_owners: dict[ast.AST, ast.AST] = {}

    def stages(self) -> list[CallablePythonRuleStage]:
        """Responsibilities: _primary Python rule stages_."""
        rules = self._state.rule_set
        return [
            rules.constructor_rules.collect_constructor_issues,
            self._state.type_rules.collect_type_issues,
            self._state.type_rules.collect_generic_types,
            rules.exception_rules.try_statement_issues,
            rules.call_rules.issues,
        ]

    def branch_count_issues(self, tree: ast.AST) -> list[JsonObject]:
        """Responsibilities: _report callable branch count_."""
        issues: list[JsonObject] = []
        for node in self._callable_nodes_for(tree):
            self._append_branch_issue(issues, node)
        return issues

    def prepare(self, analysis_tree: ast.AST) -> None:
        """Responsibilities: _primary Python rule preparation_."""
        rules = self._state.rule_set
        self._prepare_branch_counts(analysis_tree)
        rules.decorator_aliases.observe_module(analysis_tree)
        self._state.type_rules.prepare()
        rules.dynamic_type_rules.configure_imports(analysis_tree)
        rules.exception_aliases.configure_imports(analysis_tree)
        rules.call_rules.configure_reflection()

    def rule_set(self) -> PythonPrimaryRuleSetContract:
        """Responsibilities: _primary rule dependency access_."""
        return self._state.rule_set
