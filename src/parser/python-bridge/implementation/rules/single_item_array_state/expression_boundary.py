from __future__ import annotations


import ast


class PythonExpressionBoundary:
    """Responsibilities: _Python expression boundary analysis_."""

    def _previous_character(self, node: ast.AST) -> str:
        """Responsibilities: _character before expression access_."""
        line = self.source_lines[node.lineno - 1]
        index = node.col_offset
        while index > 0:
            index -= 1
            if not line[index].isspace():
                return line[index]
        return ""

    def _end_line(self, node: ast.AST) -> int:
        """Responsibilities: _identification expression end line_."""
        if node.end_lineno is not None:
            return node.end_lineno
        return node.lineno

    def _next_character(self, node: ast.AST) -> str:
        """Responsibilities: _character after expression access_."""
        line = self.source_lines[self._end_line(node) - 1]
        index = self._end_column(node)
        while index < len(line):
            if not line[index].isspace():
                return line[index]
            index += 1
        return ""

    def _end_column(self, node: ast.AST) -> int:
        """Responsibilities: _identification expression end column_."""
        if node.end_col_offset is not None:
            return node.end_col_offset
        return 0

    def _simple_boolean_wrapper(self, node: ast.AST) -> bool:
        """Responsibilities: _simple boolean wrapper_."""
        if type(node) is ast.UnaryOp and type(node.op) is ast.Not:
            return self._simple_boolean_operand(node.operand)
        if type(node) is ast.Await:
            return self._simple_boolean_operand(node.value)
        if type(node) is ast.NamedExpr:
            return self._simple_boolean_operand(node.value)
        if type(node) is not ast.IfExp:
            return False
        if not self._simple_boolean_operand(node.body):
            return False
        return self._simple_boolean_operand(node.orelse)

    def _simple_boolean_chain(self, node: ast.BoolOp) -> bool:
        """Responsibilities: _simple boolean chain_."""
        if type(node.op) not in (ast.And, ast.Or):
            return False
        if len(node.values) < 2:
            return False
        return all(self._simple_boolean_operand(value) for value in node.values)

    def _simple_boolean_operand(self, node: ast.AST) -> bool:
        """Responsibilities: _simple boolean operand_."""
        if self.parenthesized(node):
            return False
        if type(node) is ast.Constant:
            return type(node.value) is bool
        if type(node) in (ast.Name, ast.Attribute, ast.Call, ast.Subscript):
            return True
        if type(node) is ast.BoolOp:
            return self._simple_boolean_chain(node)
        return self._simple_boolean_wrapper(node)

    def _boolean_boundary(self, node: ast.BoolOp) -> bool:
        """Responsibilities: _boolean precedence boundary_."""
        if type(node.op) not in (ast.And, ast.Or):
            return False
        if len(node.values) < 2:
            return False
        boundaries = [self.ungrouped(value) for value in node.values]
        for index, boundary in enumerate(boundaries):
            if not boundary:
                continue
            other_values = [
                value for position, value in enumerate(node.values) if position != index
            ]
            if all(self._simple_boolean_operand(value) for value in other_values):
                return True
        return False

    def __init__(self, source_lines: list[str]) -> None:
        """Responsibilities: _expression boundary initialization_."""
        self.source_lines: list[str] = source_lines

    def negation_comparison_boundary(self, node: ast.AST) -> bool:
        """Responsibilities: _negation comparison boundary_."""
        if type(node) is ast.UnaryOp and type(node.op) is ast.Not:
            if type(node.operand) is not ast.Compare:
                return False
            if self.parenthesized(node.operand):
                return False
            return True
        if type(node) is not ast.Compare:
            return False
        for operand in (node.left, *node.comparators):
            if type(operand) is ast.UnaryOp and type(operand.op) is ast.Not:
                if not self.parenthesized(operand):
                    return True
        return False

    def parenthesized(self, node: ast.AST) -> bool:
        """Responsibilities: _parenthesized expressions identification_."""
        previous = self._previous_character(node)
        following = self._next_character(node)
        if previous != "(":
            return False
        return following == ")"

    def ungrouped(self, node: ast.AST, root_parenthesized: bool = False) -> bool:
        """Responsibilities: _ungrouped boolean boundary_."""
        if self.parenthesized(node):
            if not root_parenthesized:
                return False
        if type(node) in (ast.Compare, ast.BinOp):
            return True
        if type(node) is not ast.BoolOp:
            return False
        return self._boolean_boundary(node)
