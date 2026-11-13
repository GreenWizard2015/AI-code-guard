from __future__ import annotations

import ast

from implementation.ast.protocols import PythonSourceSegmentsContract


class PythonExpressionBoundary:
    """Responsibilities: _source grouping detection_, _boolean boundary analysis_."""

    def _previous_character(self, expression_start: ast.expr) -> str:
        """Responsibilities: _character before expression access_."""
        line = self._source_segments.line(expression_start.lineno)
        index = self._source_segments.character_column(
            line,
            expression_start.col_offset,
        )
        while index > 0:
            index -= 1
            if not line[index].isspace():
                return line[index]
        return ""

    def _end_line(self, source_expression: ast.expr) -> int:
        """Responsibilities: _identification expression end line_."""
        end_line = source_expression.end_lineno
        if type(end_line) is int:
            return end_line
        return source_expression.lineno

    def _next_character(self, expression_end: ast.expr) -> str:
        """Responsibilities: _character after expression access_."""
        line = self._source_segments.line(self._end_line(expression_end))
        index = self._source_segments.character_column(
            line,
            self._end_column(expression_end),
        )
        while index < len(line):
            if not line[index].isspace():
                return line[index]
            index += 1
        return ""

    def _end_column(self, source_expression: ast.expr) -> int:
        """Responsibilities: _identification expression end column_."""
        end_column = source_expression.end_col_offset
        if type(end_column) is int:
            return end_column
        return 0

    def _simple_boolean_wrapper(self, wrapper: ast.expr) -> bool:
        """Responsibilities: _simple boolean wrapper_."""
        if type(wrapper) is ast.UnaryOp and type(wrapper.op) is ast.Not:
            return self._simple_boolean_operand(wrapper.operand)
        if type(wrapper) is ast.Await:
            return self._simple_boolean_operand(wrapper.value)
        if type(wrapper) is ast.NamedExpr:
            return self._simple_boolean_operand(wrapper.value)
        if type(wrapper) is not ast.IfExp:
            return False
        if not self._simple_boolean_operand(wrapper.body):
            return False
        return self._simple_boolean_operand(wrapper.orelse)

    def _simple_boolean_chain(self, boolean_chain: ast.BoolOp) -> bool:
        """Responsibilities: _simple boolean chain_."""
        if type(boolean_chain.op) not in (ast.And, ast.Or):
            return False
        if len(boolean_chain.values) < 2:
            return False
        return all(self._simple_boolean_operand(value) for value in boolean_chain.values)

    def _simple_boolean_operand(self, operand: ast.expr) -> bool:
        """Responsibilities: _simple boolean operand_."""
        if self.parenthesized(operand):
            return False
        if type(operand) is ast.Constant:
            return type(operand.value) is bool
        if type(operand) in (ast.Name, ast.Attribute, ast.Call, ast.Subscript):
            return True
        if type(operand) is ast.BoolOp:
            return self._simple_boolean_chain(operand)
        return self._simple_boolean_wrapper(operand)

    def _single_complex_operand(self, expression_chain: ast.BoolOp) -> bool:
        """Responsibilities: _single complex boolean operand_."""
        nonsimple_count = 0
        boundary_found = False
        for value in expression_chain.values:
            if self._simple_boolean_operand(value):
                continue
            nonsimple_count += 1
            if self.ungrouped(value):
                boundary_found = True
        if not boundary_found:
            return False
        return nonsimple_count == 1

    def _boolean_boundary(self, boundary_expression: ast.BoolOp) -> bool:
        """Responsibilities: _boolean precedence boundary_."""
        if type(boundary_expression.op) not in (ast.And, ast.Or):
            return False
        if len(boundary_expression.values) < 2:
            return False
        return self._single_complex_operand(boundary_expression)

    def __init__(self, source_segments: PythonSourceSegmentsContract) -> None:
        """Responsibilities: _expression boundary initialization_."""
        self._source_segments: PythonSourceSegmentsContract = source_segments

    def negation_comparison_boundary(self, comparison: ast.expr) -> bool:
        """Responsibilities: _negation comparison boundary_."""
        if type(comparison) is ast.UnaryOp and type(comparison.op) is ast.Not:
            if type(comparison.operand) is not ast.Compare:
                return False
            return not self.parenthesized(comparison.operand)
        if type(comparison) is not ast.Compare:
            return False
        for operand in (comparison.left, *comparison.comparators):
            if type(operand) is not ast.UnaryOp:
                continue
            if type(operand.op) is not ast.Not:
                continue
            if not self.parenthesized(operand):
                return True
        return False

    def parenthesized(self, expression: ast.expr) -> bool:
        """Responsibilities: _parenthesized expressions identification_."""
        previous = self._previous_character(expression)
        following = self._next_character(expression)
        if previous != "(":
            return False
        return following == ")"

    def ungrouped(self, expression: ast.expr, root_parenthesized: bool = False) -> bool:
        """Responsibilities: _ungrouped boolean boundary_."""
        parenthesized = False
        if not root_parenthesized:
            parenthesized = self.parenthesized(expression)
        if parenthesized:
            return False
        if type(expression) in (ast.Compare, ast.BinOp):
            return True
        if type(expression) is not ast.BoolOp:
            return False
        return self._boolean_boundary(expression)
