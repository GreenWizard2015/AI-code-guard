from __future__ import annotations

import ast
from dataclasses import dataclass
from typing import TypeAlias

from implementation.types import PythonASTLocatedNode

PythonSubtestAssignmentList: TypeAlias = list[PythonASTLocatedNode]
PythonSubtestAssignmentIndex: TypeAlias = dict[ast.AST, PythonSubtestAssignmentList]
PythonSubtestAliasMap: TypeAlias = dict[str, str]
PythonSubtestNameSet: TypeAlias = set[str]
PythonSubtestTargetValues: TypeAlias = dict[str, ast.AST]
PythonSubtestAliasSourceIndex: TypeAlias = dict[PythonASTLocatedNode, PythonSubtestTargetValues]


@dataclass
class PythonSubtestAliasAnalysisState:
    """Responsibilities: _source assignment history_, _subtest alias transitions_."""

    assignments: PythonSubtestAssignmentList
    receivers: PythonSubtestAliasMap
    subtests: PythonSubtestNameSet
    assignment_aliases: PythonSubtestAliasSourceIndex
