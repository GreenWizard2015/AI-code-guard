from __future__ import annotations

import ast


class PythonTerminalBranchRules:
    """Responsibilities: _terminal statement classification_, _terminal block analysis_."""

    def _terminal_if(self, node: ast.If) -> bool:
        """Responsibilities: _terminal nested branch analysis_."""
        if not self.terminal_block(node.body):
            return False
        return self.terminal_block(node.orelse)

    def _terminal_loop(self, node: ast.While) -> bool:
        """Responsibilities: _terminal loop branch analysis_."""
        if self._require_constant_loop:
            match node.test:
                case ast.Constant(value=True):
                    pass
                case _:
                    return False
        return self.terminal_block(node.body)

    def _terminal_try(self, node: ast.Try) -> bool:
        """Responsibilities: _terminal exception branch analysis_."""
        if not self.terminal_block(node.body):
            return False
        return all(self.terminal_block(handler.body) for handler in node.handlers)

    def _terminal_fallthrough(self, node: ast.stmt) -> bool:
        """Responsibilities: _terminal fallthrough branch analysis_."""
        match node:
            case ast.If(body=body, orelse=[]):
                return self.terminal_block(body)
            case _:
                return False

    def __init__(self, require_constant_loop: bool = True) -> None:
        """Responsibilities: _terminal branch policy configuration_."""
        self._require_constant_loop: bool = require_constant_loop

    def terminal_statement(self, node: ast.stmt) -> bool:
        """Responsibilities: _terminal statement analysis_."""
        match node:
            case ast.Return():
                return True
            case ast.If():
                return self._terminal_if(node)
            case ast.With(body=body) | ast.AsyncWith(body=body):
                return self.terminal_block(body)
            case ast.While():
                return self._terminal_loop(node)
            case ast.Try():
                return self._terminal_try(node)
            case _:
                return False

    def terminal_block(self, statements: list[ast.stmt]) -> bool:
        """Responsibilities: _terminal statement block analysis_."""
        if not statements:
            return False
        if len(statements) == 1:
            return self.terminal_statement(statements[0])
        if not self.terminal_statement(statements[-1]):
            return False
        return all(self._terminal_fallthrough(statement) for statement in statements[:-1])
