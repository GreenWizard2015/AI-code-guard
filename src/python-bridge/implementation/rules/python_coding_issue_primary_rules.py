from __future__ import annotations

import ast
from collections.abc import Callable

from implementation.constructor_rules import ConstructorRules
from implementation.protocols import (
    PythonAstNodeIndexContract,
    PythonCallRulesContract,
    PythonCodingIssueComponentContextContract,
    PythonDecoratorAliasesContract,
    PythonDecoratorRulesContract,
    PythonDynamicTypeRulesContract,
    PythonExceptionAliasStateContract,
    PythonExceptionRulesContract,
    PythonTypeFactoryNamesContract,
)
from implementation.rules.python_syntax.python_primary_assembly import (
    PythonPrimaryRuleAssembly,
)
from implementation.rules.constants import MAX_CALLABLE_BRANCHES
from implementation.rules.type_rules.type_rules import TypeRules
from implementation.types import JsonObject

PythonRuleStage = Callable[[ast.AST], list[JsonObject]]


class PythonCodingIssuePrimaryRules:
    """Responsibilities: _rule stage composition_, _branch count preparation_."""

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

    def _callable_owner(self, node: ast.AST, owners: dict[ast.AST, ast.AST]) -> ast.AST:
        """Responsibilities: _callable ownership_."""
        if type(node) in (ast.FunctionDef, ast.AsyncFunctionDef, ast.Lambda):
            return node
        parents = self.node_index.parents(node)
        if not parents:
            return node
        parent = parents[0]
        if parent not in owners:
            return node
        return owners[parent]

    def _record_branch_count(self, node: ast.AST, owner: ast.AST) -> None:
        """Responsibilities: _branch count recording_."""
        if type(owner) not in (ast.FunctionDef, ast.AsyncFunctionDef):
            return
        branch_count = self._branch_count_node(node)
        if branch_count:
            self._branch_counts[owner] = (
                self._branch_counts.get(owner, 0) + branch_count
            )

    def _prepare_branch_counts(self, tree: ast.AST) -> None:
        """Responsibilities: _branch count index_."""
        self._branch_counts.clear()
        owners: dict[ast.AST, ast.AST] = {}
        for node in self.node_index.nodes(tree):
            owner = self._callable_owner(node, owners)
            owners[node] = owner
            self._record_branch_count(node, owner)

    def __init__(self, context: PythonCodingIssueComponentContextContract) -> None:
        """Responsibilities: _primary Python rule construction_."""
        assembly = PythonPrimaryRuleAssembly(context)
        call_state = assembly.call_state()
        type_state = assembly.type_state()
        self.call_rules: PythonCallRulesContract = call_state.call_rules
        self.decorator_rules: PythonDecoratorRulesContract = call_state.decorator_rules
        self.decorator_aliases: PythonDecoratorAliasesContract = (
            call_state.decorator_aliases
        )
        self.dynamic_type_rules: PythonDynamicTypeRulesContract = (
            type_state.dynamic_rules()
        )
        self.exception_aliases: PythonExceptionAliasStateContract = (
            type_state.exception_aliases()
        )
        self.exception_rules: PythonExceptionRulesContract = (
            type_state.exception_rules()
        )
        self.constructor_rules: ConstructorRules = ConstructorRules()
        self.type_factory_names: PythonTypeFactoryNamesContract = (
            type_state.type_factory_names()
        )
        self.type_rules: TypeRules = TypeRules(
            context.tree, self.decorator_rules, self.type_factory_names
        )
        self.node_index: PythonAstNodeIndexContract = context.node_index
        self._branch_counts: dict[ast.AST, int] = {}

    def stages(self) -> list[PythonRuleStage]:
        """Responsibilities: _primary Python rule stages_."""
        return [
            self.constructor_rules.collect_constructor_issues,
            self.type_rules.collect_type_issues,
            self.type_rules.collect_generic_types,
            self.exception_rules.try_statement_issues,
            self.call_rules.collect_call_issues,
        ]

    def branch_count_issues(self, tree: ast.AST) -> list[JsonObject]:
        """Responsibilities: _report callable branch count_."""
        issues: list[JsonObject] = []
        for node in self.node_index.nodes(tree):
            if type(node) not in (ast.FunctionDef, ast.AsyncFunctionDef):
                continue
            if self._branch_counts.get(node, 0) > MAX_CALLABLE_BRANCHES:
                issues.append(
                    {
                        "line": node.lineno - 1,
                        "kind": "callable-branch-count",
                        "name": node.name,
                    }
                )
        return issues

    def prepare(self, tree: ast.AST) -> None:
        """Responsibilities: _primary Python rule preparation_."""
        self._prepare_branch_counts(tree)
        self.decorator_aliases.observe_module(tree)
        self.type_rules.prepare()
        self.dynamic_type_rules.configure_imports(tree)
        self.exception_aliases.configure_imports(tree)
        self.call_rules.prepare()
