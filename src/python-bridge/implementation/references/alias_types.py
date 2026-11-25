from __future__ import annotations

import ast
from collections.abc import Callable
from typing import TypeAlias

from implementation.types import JsonObject
from implementation.types import PythonASTLocatedNode

SequenceExpression: TypeAlias = ast.List | ast.Tuple | ast.Set


ContainerItemMap: TypeAlias = dict[str, ast.AST]
ContainerAliasMap: TypeAlias = dict[str, ContainerItemMap]
ContainerAliasScopes: TypeAlias = dict[str, ContainerAliasMap]
StaticContainerAliasMap: TypeAlias = dict[str, str]
StaticContainerAliasScopes: TypeAlias = dict[str, StaticContainerAliasMap]
ExpandedContainerValues: TypeAlias = list[ast.AST]
AssignmentCacheKey: TypeAlias = tuple[int, int]
AssignmentAliasValues: TypeAlias = dict[str, ast.AST]
AssignmentAliasCache: TypeAlias = dict[AssignmentCacheKey, AssignmentAliasValues]
TreeAliasSnapshot: TypeAlias = tuple[JsonObject, ...]
TreeAliasCache: TypeAlias = dict[ast.Module, TreeAliasSnapshot]
CallablePythonReferenceOperation: TypeAlias = Callable[[], None]
CallablePythonStringValue: TypeAlias = Callable[[ast.AST], str]
PythonSubtestAssignmentList: TypeAlias = list[PythonASTLocatedNode]
PythonSubtestAssignmentIndex: TypeAlias = dict[ast.AST, PythonSubtestAssignmentList]
PythonSubtestAliasMap: TypeAlias = dict[str, str]
PythonSubtestNameSet: TypeAlias = set[str]
PythonSubtestTargetValues: TypeAlias = dict[str, ast.AST]
PythonSubtestAliasSourceIndex: TypeAlias = dict[PythonASTLocatedNode, PythonSubtestTargetValues]
PythonSubtestAnalysisCache: TypeAlias = dict[ast.AST, "PythonSubtestAliasAnalysisContract"]
