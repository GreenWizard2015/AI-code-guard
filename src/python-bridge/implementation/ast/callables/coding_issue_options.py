from __future__ import annotations

import ast
from dataclasses import dataclass

from implementation.ast.protocols import (
    PythonAstNodeIndexContract,
    PythonSourceSegmentsContract,
)
from implementation.rules.protocols import (
    PythonCodingIssueAliasesContract,
    PythonCodingIssueSourceContract,
    PythonTerminalBranchContract,
)


@dataclass(frozen=True)
class PythonCodingIssueSource:
    """Responsibilities: _Python AST source inputs_."""

    tree: ast.AST
    source: str
    source_segments: PythonSourceSegmentsContract
    node_index: PythonAstNodeIndexContract


@dataclass(frozen=True)
class PythonCodingIssueRules:
    """Responsibilities: _coding issue rule dependencies_."""

    terminal_branches: PythonTerminalBranchContract


@dataclass(frozen=True)
class PythonCodingIssueCollectorOptions:
    """Responsibilities: _coding issue collection inputs_."""

    source: PythonCodingIssueSourceContract
    aliases: PythonCodingIssueAliasesContract
    rules: PythonCodingIssueRules
