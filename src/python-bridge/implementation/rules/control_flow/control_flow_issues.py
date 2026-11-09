from __future__ import annotations

import ast
from dataclasses import dataclass
from typing import Any

from implementation.ast.protocols import (
    PythonAstNodeIndexContract,
    PythonSourceSegmentsContract,
)
from implementation.rules.constants import (
    PYTHON_ASSIGNMENT_EXPRESSION_RULE,
    PYTHON_ELIF_RULE,
    PYTHON_TERNARY_KIND,
)
from implementation.rules.control_flow.python_logical_chain_analysis import (
    PythonLogicalChainAnalysis,
)
from implementation.rules.protocols import (
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
    terminal_branches: PythonTerminalBranchContract
    source_metrics: PythonSourceSegmentsContract


class PythonControlFlowIssues:
    """Responsibilities: _conditional expression policy_, _terminal branch policy_."""

    def _if_expression_issues(self, node: ast.IfExp) -> list[JsonObject]:
        """Responsibilities: _ternary-expression violations detection_."""
        constant_body = type(node.body) is ast.Constant
        constant_else = type(node.orelse) is ast.Constant
        if not constant_body:
            return [{"line": node.lineno - 1, "kind": PYTHON_TERNARY_KIND}]
        if constant_else:
            return []
        parent = self._parent_node(node)
        if self._primitive_annotated_value(parent, node):
            return []
        return [{"line": node.lineno - 1, "kind": PYTHON_TERNARY_KIND}]

    def _parent_node(self, node: ast.AST) -> ast.AST:
        """Responsibilities: _AST parent lookup_."""
        node_index = self._options.node_index
        node_index.nodes(self._options.tree)
        parents = node_index.parents(node)
        if parents:
            return parents[-1]
        return ast.AST()

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

    def _early_return_issues(self, node: ast.If) -> list[JsonObject]:
        """Responsibilities: _branch exit preference_."""
        if not self._options.terminal_branches.terminal_block(node.body):
            return []
        if not self._options.terminal_branches.terminal_block(node.orelse):
            return []
        return [{"line": node.lineno - 1, "kind": "early-return"}]

    def _boolean_identity_return(self, node: ast.If) -> list[JsonObject]:
        """Responsibilities: _boolean identity branch_."""
        if len(node.body) != 1 or type(node.body[0]) is not ast.Return or node.orelse:
            return []
        if type(node.test) is not ast.Compare or type(node.test.left) is not ast.Name:
            return []
        if len(node.test.ops) != 1 or type(node.test.ops[0]) is not ast.Is:
            return []
        if len(node.test.comparators) != 1:
            return []
        value = node.test.comparators[0]
        if type(value) is not ast.Constant or type(value.value) is not bool:
            return []
        return [{"line": node.lineno - 1, "kind": "pointless-boolean-operation"}]

    def __init__(self, options: PythonControlFlowOptions) -> None:
        """Responsibilities: _Python control-flow analysis initialization_."""
        self._options: PythonControlFlowOptions = options

    def conditional_issues(self, expression_node: ast.AST) -> list[JsonObject]:
        """Responsibilities: _conditional-expression violations collection_."""
        if type(expression_node) is ast.If:
            issues = self._boolean_identity_return(expression_node)
            issues.extend(self._early_return_issues(expression_node))
            return issues
        if type(expression_node) is ast.IfExp:
            return self._if_expression_issues(expression_node)
        if type(expression_node) is not ast.BoolOp:
            return []
        self._options.node_index.nodes(self._options.tree)
        chain_analysis = PythonLogicalChainAnalysis(
            expression_node,
            self._options.node_index,
            self._options.source_lines,
            self._options.source_metrics,
            self._options.assignment_values,
        )
        return chain_analysis.issues()

    def elif_issues(self, if_statement: ast.AST) -> list[JsonObject]:
        """Responsibilities: _Python elif violations collection_."""
        if type(if_statement) is not ast.If:
            return []
        if not if_statement.orelse:
            return []
        first: Any = if_statement.orelse[0]
        if type(first) is not ast.If:
            return []
        line: Any = first.lineno - 1
        if line >= len(self._options.source_lines):
            return []
        if not self._options.source_lines[line].lstrip().startswith("elif "):
            return []
        return [{"line": first.lineno - 1, "kind": PYTHON_ELIF_RULE}]

    def walrus_issues(self, assignment_expression: ast.AST) -> list[JsonObject]:
        """Responsibilities: _Python walrus violations collection_."""
        if type(assignment_expression) is not ast.NamedExpr:
            return []
        return [
            {
                "line": assignment_expression.lineno - 1,
                "kind": PYTHON_ASSIGNMENT_EXPRESSION_RULE,
            },
        ]
