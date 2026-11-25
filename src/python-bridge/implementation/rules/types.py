from __future__ import annotations

import ast
from typing import TypeAlias

from implementation.types import (
    JsonObject,
    PythonASTLocatedNode,
    PythonCallableAstNode,
)

PythonTestMutationIndex = dict[ast.AST, set[ast.AST]]
PythonScopeTypes = set[type[ast.AST]]
PythonAliasTimeline: TypeAlias = list[JsonObject]
PythonScopeAliasHistoryData: TypeAlias = dict[str, PythonAliasTimeline]
PythonScopeAliasHistories: TypeAlias = dict[ast.AST, PythonScopeAliasHistoryData]
PythonAstLocatedNodeListIndex: TypeAlias = dict[ast.AST, list[PythonASTLocatedNode]]
PythonTemporalReaderIndex: TypeAlias = dict[str, set[PythonCallableAstNode]]
