from __future__ import annotations

import ast
from implementation.rules.constants import PYTHON_TERNARY_KIND
from dataclasses import dataclass
from functools import cached_property
from typing import Any

from implementation.protocols import (
    PythonAstNodeIndexContract,
    PythonPredicateConditionContract,
    PythonSourceSegmentsContract,
    PythonTerminalBranchContract,
)
from implementation.types import JsonObject


@dataclass(frozen=True)
class PythonControlFlowOptions:
    """Responsibilities: _branch state_, _terminal rules_."""

    tree: ast.AST
    source_lines: list[str]
    assignment_values: set[int]
    node_index: PythonAstNodeIndexContract
    python_predicate_condition: PythonPredicateConditionContract
    terminal_branches: PythonTerminalBranchContract
    source_metrics: PythonSourceSegmentsContract


class PythonControlFlowIssues:
    """Responsibilities: _conditional expression policy_, _terminal branch policy_."""

    MAX_CHAIN_CHARS: int = 100

    def _if_expression_issues(self, node: ast.IfExp) -> list[JsonObject]:
        """Responsibilities: _ternary-expression violations detection_."""
        constant_body = type(node.body) is ast.Constant
        constant_else = type(node.orelse) is ast.Constant
        if not constant_body:
            return [{"line": node.lineno - 1, "kind": PYTHON_TERNARY_KIND}]
        if constant_else:
            return []
        parent: ast.AST = self._parents.get(id(node), ast.AST())
        if self._primitive_annotated_value(parent, node):
            return []
        return [{"line": node.lineno - 1, "kind": PYTHON_TERNARY_KIND}]

    def _primitive_annotated_value(self, parent: ast.AST, node: ast.IfExp) -> bool:
        """Responsibilities: _primitive annotated ternaries classification_."""
        if type(parent) is not ast.AnnAssign:
            return False
        if parent.value is not node:
            return False
        if type(parent.annotation) is not ast.Name:
            return False
        return parent.annotation.id in {
            "str",
            "int",
            "float",
            "bool",
            "bytes",
            "complex",
        }

    def _boolean_expression_issues(self, node: ast.BoolOp) -> list[JsonObject]:
        """Responsibilities: _conditional-expression violations detection_."""
        if type(node.op) not in (ast.And, ast.Or):
            return []
        if all(type(value) is ast.Constant for value in node.values):
            return []
        parent = self._parents.get(id(node), ast.AST())
        return self.python_predicate_condition.violation(
            node, parent, self.assignment_values
        )

    def _early_return_issues(self, node: ast.If) -> list[JsonObject]:
        """Responsibilities: _branch exit preference_."""
        if not self.terminal_branches.terminal_block(node.body):
            return []
        if not self.terminal_branches.terminal_block(node.orelse):
            return []
        return [{"line": node.lineno - 1, "kind": "early-return"}]

    def _boolean_identity_return(self, node: ast.If) -> list[JsonObject]:
        """Responsibilities: _boolean identity branch_."""
        if len(node.body) != 1 or type(node.body[0]) is not ast.Return:
            return []
        if node.orelse:
            return []
        if type(node.test) is not ast.Compare:
            return []
        if len(node.test.ops) != 1 or type(node.test.ops[0]) is not ast.Is:
            return []
        if len(node.test.comparators) != 1:
            return []
        value = node.test.comparators[0]
        if type(value) is not ast.Constant or type(value.value) is not bool:
            return []
        return [{"line": node.lineno - 1, "kind": "pointless-boolean-operation"}]

    def _logical_part_count(self, node: ast.AST) -> int:
        """Responsibilities: _logical expression part count_."""
        if type(node) is not ast.BoolOp:
            return 1
        return sum(self._logical_part_count(value) for value in node.values)

    def _logical_chain_issues(self, node: ast.BoolOp) -> list[JsonObject]:
        """Responsibilities: _long logical chains detection_."""
        if self._short_logical_chain(node):
            return []
        return [{"line": node.lineno - 1, "kind": "logical-chain-size"}]

    def _short_logical_chain(self, node: ast.BoolOp) -> bool:
        """Responsibilities: _classification logical chain stays_."""
        parent: ast.AST = self._parents.get(id(node), ast.AST())
        if self._inside_lambda(node):
            return True
        is_assignment_value = type(parent) in (ast.Assign, ast.AnnAssign)
        if is_assignment_value:
            if parent.value is node:
                return True
        if type(parent) is ast.BoolOp:
            return True
        return self._short_chain_metrics(node)

    def _short_chain_metrics(self, node: ast.BoolOp) -> bool:
        """Responsibilities: _logical chain metrics_."""
        short_chain = self._logical_part_count(node) <= 3
        source_segment = self._source_segment(node)
        short_expression = (
            self.source_metrics.significant_characters(source_segment)
            < self.MAX_CHAIN_CHARS
        )
        if not short_chain:
            return False
        return short_expression

    def _inside_lambda(self, node: ast.AST) -> bool:
        """Responsibilities: _expressions inside lambdas identification_."""
        parent: ast.AST = self._parents.get(id(node), ast.AST())
        while type(parent) is not ast.AST:
            if type(parent) is ast.Lambda:
                return True
            parent = self._parents.get(id(parent), ast.AST())
        return False

    def _source_segment(self, node: ast.AST) -> str:
        """Responsibilities: _source segment access_."""
        lines = self.source_lines[node.lineno - 1 : node.end_lineno]
        if not lines:
            return ""
        if len(lines) == 1:
            return lines[0][node.col_offset : node.end_col_offset]
        lines[0] = lines[0][node.col_offset :]
        lines[-1] = lines[-1][: node.end_col_offset]
        return "\n".join(lines)

    @cached_property
    def _parents(self) -> dict[int, ast.AST]:
        """Responsibilities: _collection Python AST parent_."""
        parents: dict[int, ast.AST] = {}
        for parent in self.node_index.nodes(self.tree):
            for child in ast.iter_child_nodes(parent):
                parents[id(child)] = parent
        return parents

    def __init__(self, options: PythonControlFlowOptions) -> None:
        """Responsibilities: _Python control-flow analysis initialization_."""
        self.tree: Any = options.tree
        self.source_lines: Any = options.source_lines
        self.assignment_values: Any = options.assignment_values
        self.node_index: Any = options.node_index
        self.python_predicate_condition: PythonPredicateConditionContract = (
            options.python_predicate_condition
        )
        self.source_metrics: PythonSourceSegmentsContract = options.source_metrics
        self.terminal_branches: PythonTerminalBranchContract = options.terminal_branches

    def conditional_issues(self, node: ast.AST) -> list[JsonObject]:
        """Responsibilities: _conditional-expression violations collection_."""
        if type(node) is ast.If:
            issues = self._boolean_identity_return(node)
            issues.extend(self._early_return_issues(node))
            return issues
        if type(node) is ast.IfExp:
            return self._if_expression_issues(node)
        if type(node) is not ast.BoolOp:
            return []
        issues = self._boolean_expression_issues(node)
        issues.extend(self._logical_chain_issues(node))
        return issues

    def elif_issues(self, node: ast.AST) -> list[JsonObject]:
        """Responsibilities: _Python elif violations collection_."""
        if type(node) is not ast.If:
            return []
        if not node.orelse:
            return []
        first: Any = node.orelse[0]
        if type(first) is not ast.If:
            return []
        line: Any = first.lineno - 1
        if line >= len(self.source_lines):
            return []
        if not self.source_lines[line].lstrip().startswith("elif "):
            return []
        return [{"line": first.lineno - 1, "kind": "python-elif"}]

    def walrus_issues(self, node: ast.AST) -> list[JsonObject]:
        """Responsibilities: _Python walrus violations collection_."""
        if type(node) is not ast.NamedExpr:
            return []
        return [{"line": node.lineno - 1, "kind": "python-assignment-expression"}]
