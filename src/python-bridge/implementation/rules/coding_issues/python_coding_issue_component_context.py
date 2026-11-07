from __future__ import annotations

import ast

from implementation.ast.protocols import PythonAstNodeIndexContract, PythonSourceSegmentsContract
from implementation.rules.control_flow.python_expression_boundary import PythonExpressionBoundary
from implementation.rules.protocols import (
    PythonCodingIssueAliasesContract,
    PythonCodingIssueComponentContextContract,
    PythonCodingIssueOptionsContract,
    PythonExpressionBoundaryContract,
    PythonTerminalBranchContract,
)


class PythonCodingIssueComponentContext(PythonCodingIssueComponentContextContract):
    """Responsibilities: _rule input storage_, _analysis dependency ownership_."""

    _tree: ast.AST
    _node_index: PythonAstNodeIndexContract
    _source_text: str
    _source_segments: PythonSourceSegmentsContract
    _expression_boundary: PythonExpressionBoundaryContract
    _aliases: PythonCodingIssueAliasesContract
    _terminal_branches: PythonTerminalBranchContract

    def __init__(self, options: PythonCodingIssueOptionsContract) -> None:
        """Responsibilities: _construction input extraction_."""
        source = options.source
        self._tree = source.tree
        self._node_index = source.node_index
        self._source_text = source.source
        self._source_segments = source.source_segments
        self._expression_boundary = PythonExpressionBoundary(source.source_segments)
        self._aliases = options.aliases
        self._terminal_branches = options.rules.terminal_branches

    def tree(self) -> ast.AST:
        """Responsibilities: _tree access_."""
        return self._tree

    def node_index(self) -> PythonAstNodeIndexContract:
        """Responsibilities: _node index access_."""
        return self._node_index

    def source_text(self) -> str:
        """Responsibilities: _source text access_."""
        return self._source_text

    def source_segments(self) -> PythonSourceSegmentsContract:
        """Responsibilities: _source segments access_."""
        return self._source_segments

    def expression_boundary(self) -> PythonExpressionBoundaryContract:
        """Responsibilities: _expression boundary access_."""
        return self._expression_boundary

    def aliases(self) -> PythonCodingIssueAliasesContract:
        """Responsibilities: _coding issue alias groups_."""
        return self._aliases

    def terminal_branches(self) -> PythonTerminalBranchContract:
        """Responsibilities: _terminal branches access_."""
        return self._terminal_branches
