from __future__ import annotations

import ast
from collections.abc import Callable
from typing import TypeAlias

JsonValueReference: TypeAlias = "JsonValue"
JsonValueList: TypeAlias = list[JsonValueReference]
JsonValueMap: TypeAlias = dict[str, JsonValueReference]
JsonScalar: TypeAlias = str | int | float | bool | None
JsonValue: TypeAlias = JsonScalar | JsonValueList | JsonValueMap
JsonObject: TypeAlias = dict[str, JsonValue]
PythonProxyAliasAssignment: TypeAlias = tuple[int, str, str]
PythonProxyAliasRecords: TypeAlias = dict[str, list[PythonProxyAliasAssignment]]
PythonAstParents: TypeAlias = dict[int, list[ast.AST]]
LiteralMetadata: TypeAlias = dict[str, list[JsonObject]]
PythonOperatorKinds: TypeAlias = set[type[ast.AST]]
PythonDecoratorAliasGroups: TypeAlias = dict[str, set[str]]
PythonRuleStage: TypeAlias = Callable[[ast.AST], list[JsonObject]]
