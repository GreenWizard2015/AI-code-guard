from __future__ import annotations


from typing import TypeAlias
import ast


JsonValue: TypeAlias = (
    str | int | float | bool | None | list["JsonValue"] | dict[str, "JsonValue"]
)
JsonObject: TypeAlias = dict[str, JsonValue]
OperatorTypes: TypeAlias = set[type[ast.AST]]
