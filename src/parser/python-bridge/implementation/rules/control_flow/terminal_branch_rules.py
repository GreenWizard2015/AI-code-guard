from __future__ import annotations

import ast


class PythonTerminalBranchRules:
    """Responsibilities: _terminal Python branch analysis_."""

    def _terminal_if(self, node: ast.If) -> bool:
        """Responsibilities: _terminal nested branch analysis_."""
        if not self.terminal_block(node.body):
            return False
        return self.terminal_block(node.orelse)

    def _terminal_loop(self, node: ast.While) -> bool:
        """Responsibilities: _terminal loop branch analysis_."""
        if self.require_constant_loop:
            if type(node.test) is not ast.Constant or node.test.value is not True:
                return False
        return self.terminal_block(node.body)

    def _terminal_try(self, node: ast.Try) -> bool:
        """Responsibilities: _terminal exception branch analysis_."""
        if not self.terminal_block(node.body):
            return False
        return all(self.terminal_block(handler.body) for handler in node.handlers)

    def _terminal_fallthrough(self, node: ast.stmt) -> bool:
        """Responsibilities: _terminal fallthrough branch analysis_."""
        if type(node) is not ast.If or node.orelse:
            return False
        return self.terminal_block(node.body)

    def __init__(self, require_constant_loop: bool = True) -> None:
        """Responsibilities: _terminal branch policy configuration_."""
        self.require_constant_loop: bool = require_constant_loop

    def terminal_statement(self, node: ast.stmt) -> bool:
        """Responsibilities: _terminal statement analysis_."""
        if type(node) is ast.Return:
            return True
        if type(node) is ast.If:
            return self._terminal_if(node)
        if type(node) in (ast.With, ast.AsyncWith):
            return self.terminal_block(node.body)
        if type(node) is ast.While:
            return self._terminal_loop(node)
        if type(node) is ast.Try:
            return self._terminal_try(node)
        return False

    def terminal_block(self, statements: list[ast.stmt]) -> bool:
        """Responsibilities: _terminal statement block analysis_."""
        if not statements:
            return False
        if len(statements) == 1:
            return self.terminal_statement(statements[0])
        if not self.terminal_statement(statements[-1]):
            return False
        return all(
            self._terminal_fallthrough(statement) for statement in statements[:-1]
        )
