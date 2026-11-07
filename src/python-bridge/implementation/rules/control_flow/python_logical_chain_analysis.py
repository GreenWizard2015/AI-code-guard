from __future__ import annotations

import ast

from implementation.ast.protocols import (
    PythonAstNodeIndexContract,
    PythonSourceSegmentsContract,
)
from implementation.rules.constants import (
    PYTHON_CONDITIONAL_EXECUTION_KIND,
    PYTHON_KNOWN_PREDICATE_NAMES,
    PYTHON_LOGICAL_CHAIN_MAX_CHARS,
    PYTHON_LOGICAL_CHAIN_SIZE_KIND,
)
from implementation.rules.protocols import PythonLogicalChainAnalysisContract
from implementation.types import JsonObject


class PythonLogicalChainAnalysis(PythonLogicalChainAnalysisContract):
    """Responsibilities: _logical chain policy_, _conditional execution policy_."""

    def parent(self, node: ast.AST) -> ast.AST:
        """Responsibilities: _logical expression parent lookup_."""
        parents = self._node_index.parents(node)
        if parents:
            return parents[-1]
        return ast.AST()

    def _inside_lambda(self) -> bool:
        """Responsibilities: _lambda ancestor detection_."""
        ancestor = self.parent(self._expression)
        while type(ancestor) is not ast.AST:
            if type(ancestor) is ast.Lambda:
                return True
            ancestor = self.parent(ancestor)
        return False

    def _part_count(self) -> int:
        """Responsibilities: _logical expression part count_."""
        pending: list[ast.AST] = [self._expression]
        count = 0
        while pending:
            current = pending.pop()
            if type(current) is ast.BoolOp:
                pending.extend(current.values)
            else:
                count += 1
        return count

    def _source_is_short(self) -> bool:
        """Responsibilities: _logical expression source measurement_."""
        lines = self._source_lines[self._expression.lineno - 1 : self._expression.end_lineno]
        if len(lines) == 1:
            source = lines[0][self._expression.col_offset : self._expression.end_col_offset]
        else:
            if not lines:
                source = ""
            else:
                lines[0] = lines[0][self._expression.col_offset :]
                lines[-1] = lines[-1][: self._expression.end_col_offset]
                source = "\n".join(lines)
        return self._source_metrics.significant_characters(source) < PYTHON_LOGICAL_CHAIN_MAX_CHARS

    def _predicate_call_is_pure(self, candidate: ast.AST) -> bool:
        """Responsibilities: _predicate call purity_."""
        if type(candidate) is not ast.Call:
            return True
        match candidate.func:
            case ast.Name(id=name) | ast.Attribute(attr=name):
                pass
            case _:
                return False
        return name in PYTHON_KNOWN_PREDICATE_NAMES

    def _conditional_execution_issue(self) -> list[JsonObject]:
        """Responsibilities: _conditional execution diagnostic_."""
        return [
            {
                "line": self._expression.lineno - 1,
                "kind": PYTHON_CONDITIONAL_EXECUTION_KIND,
            },
        ]

    def _conditional_execution_issues(self) -> list[JsonObject]:
        """Responsibilities: _conditional execution classification_."""
        expression = self._expression
        if type(expression.op) not in (ast.And, ast.Or):
            return []
        if all(type(value) is ast.Constant for value in expression.values):
            return []
        parent = self.parent(expression)
        if type(parent) is ast.Expr:
            return self._conditional_execution_issue()
        if type(parent) is ast.BoolOp:
            return []
        if all(self._predicate_call_is_pure(candidate) for candidate in ast.walk(expression)):
            return []
        if id(expression) in self._assignment_values:
            return self._conditional_execution_issue()
        if type(parent) in (
            ast.Module,
            ast.FunctionDef,
            ast.AsyncFunctionDef,
            ast.ClassDef,
        ):
            return []
        return self._conditional_execution_issue()

    def __init__(
        self,
        expression: ast.BoolOp,
        node_index: PythonAstNodeIndexContract,
        source_lines: list[str],
        source_metrics: PythonSourceSegmentsContract,
        assignment_values: set[int],
    ) -> None:
        """Responsibilities: _logical chain analysis initialization_."""
        self._expression: ast.BoolOp = expression
        self._node_index: PythonAstNodeIndexContract = node_index
        self._source_lines: list[str] = source_lines
        self._source_metrics: PythonSourceSegmentsContract = source_metrics
        self._assignment_values: set[int] = assignment_values

    def issues(self) -> list[JsonObject]:
        """Responsibilities: _logical chain diagnostics collection_."""
        issues = self._conditional_execution_issues()
        parent = self.parent(self._expression)
        match parent:
            case ast.Assign(value=value) | ast.AnnAssign(value=value):
                if value is self._expression:
                    return issues
            case _:
                pass
        if type(parent) is ast.BoolOp:
            return issues
        if self._inside_lambda():
            return issues
        if self._part_count() > 3:
            issues.append(
                {
                    "line": self._expression.lineno - 1,
                    "kind": PYTHON_LOGICAL_CHAIN_SIZE_KIND,
                },
            )
            return issues
        if not self._source_is_short():
            issues.append(
                {
                    "line": self._expression.lineno - 1,
                    "kind": PYTHON_LOGICAL_CHAIN_SIZE_KIND,
                },
            )
        return issues
