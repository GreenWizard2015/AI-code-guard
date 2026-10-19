from __future__ import annotations

import ast
from typing import TypeAlias

JsonValueReference: TypeAlias = "JsonValue"
JsonValueList: TypeAlias = list[JsonValueReference]
JsonValueMap: TypeAlias = dict[str, JsonValueReference]
JsonValue: TypeAlias = str | int | float | bool | None | JsonValueList | JsonValueMap
JsonObject: TypeAlias = dict[str, JsonValue]
OperatorTypes: TypeAlias = set[type[ast.AST]]
AstParentIndex: TypeAlias = dict[int, list[ast.AST]]
PythonProxyAliasAssignment: TypeAlias = tuple[int, str, str]
PythonProxyAliasRecords: TypeAlias = dict[str, list[PythonProxyAliasAssignment]]
LiteralMetadata: TypeAlias = dict[str, list[JsonObject]]
PythonAliasHistoryData: TypeAlias = dict[str, list[JsonObject]]
