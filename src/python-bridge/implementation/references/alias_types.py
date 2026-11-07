from __future__ import annotations

import ast
from collections.abc import Callable
from dataclasses import dataclass
from typing import TypeAlias

from implementation.types import JsonObject

SequenceExpression: TypeAlias = ast.List | ast.Tuple | ast.Set


@dataclass(frozen=True)
class PythonContainerItemRequest:
    """Responsibilities: _container item lookup expression_, _lookup key_."""

    expression: ast.AST
    key: str


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
