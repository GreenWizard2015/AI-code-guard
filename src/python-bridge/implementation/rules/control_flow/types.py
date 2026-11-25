from __future__ import annotations

import ast
from dataclasses import dataclass

from implementation.ast.protocols import (
    PythonAstNodeIndexContract,
    PythonSourceSegmentsContract,
)
from implementation.rules.protocols import (
    PythonMethodRecordContract,
    PythonTerminalBranchContract,
    PythonTemporalFieldStateContract,
)
from implementation.rules.types import PythonTemporalReaderIndex


@dataclass(frozen=True)
class PythonControlFlowOptions:
    """Responsibilities: _branch state_, _terminal rules_."""

    tree: ast.AST
    source_lines: list[str]
    assignment_values: set[int]
    node_index: PythonAstNodeIndexContract
    terminal_branches: PythonTerminalBranchContract
    source_metrics: PythonSourceSegmentsContract


@dataclass(frozen=True)
class OperatorAppendOptions:
    """Responsibilities: _operator family_, _parenthesized root boundary_."""

    boolean_group: bool
    root_parenthesized: bool


@dataclass
class ClassMethodRecords:
    """Responsibilities: _class method records_, _class field state_."""

    methods: list[PythonMethodRecordContract]
    field_state: PythonTemporalFieldStateContract


@dataclass
class PythonTemporalFieldState:
    """Responsibilities: _class field initialization_, _field reader index_."""

    initialized_fields: set[str]
    readers: PythonTemporalReaderIndex
