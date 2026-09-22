from __future__ import annotations

from typing import Any
import ast
from functools import cached_property
from implementation.ast.protocols import PythonAstNodeIndexProtocol
from implementation.ast.source_segments import SourceSegments
from implementation.types import JsonObject


class PythonControlFlowIssues:
    """Responsibilities: _detection Python control-flow policy_."""

    _MAX_CHAIN_CHARS: int = 100

    def _if_expression_issues(self, node: ast.IfExp) -> list[JsonObject]:
        """Responsibilities: _ternary-expression violations detection_."""
        constant_body = type(node.body) is ast.Constant
        constant_else = type(node.orelse) is ast.Constant
        if not constant_body:
            return [{"line": node.lineno - 1, "kind": "ternary-expression"}]
        if constant_else:
            return []
        parent: ast.AST = self._parents.get(id(node), ast.AST())
        if self._primitive_annotated_value(parent, node):
            return []
        return [{"line": node.lineno - 1, "kind": "ternary-expression"}]

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
        if id(node) not in self.assignment_values:
            return []
        if all(type(value) is ast.Constant for value in node.values):
            return []
        return [{"line": node.lineno - 1, "kind": "conditional-execution"}]

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
        if is_assignment_value and parent.value is node:
            return True
        if type(parent) is ast.BoolOp:
            return True
        short_chain = self._logical_part_count(node) <= 3
        source_segment = self._source_segment(node)
        short_expression = (
            self.source_metrics.significant_characters(source_segment)
            < self._MAX_CHAIN_CHARS
        )
        return short_chain and short_expression

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

    def __init__(
        self,
        tree: ast.AST,
        source_lines: list[str],
        assignment_values: set[int],
        node_index: PythonAstNodeIndexProtocol,
    ) -> None:
        """Responsibilities: _Python control-flow analysis initialization_."""
        self.tree: Any = tree
        self.source_lines: Any = source_lines
        self.assignment_values: Any = assignment_values
        self.node_index: Any = node_index
        self.source_metrics: SourceSegments = SourceSegments("\n".join(source_lines))

    def conditional_issues(self, node: ast.AST) -> list[JsonObject]:
        """Responsibilities: _conditional-expression violations collection_."""
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
        return [{"line": node.lineno - 1, "kind": "python-walrus"}]
