from __future__ import annotations

import ast

from implementation.ast.protocols import PythonModuleInstanceStatementContract
from implementation.references.protocols import PythonReferenceAliasesContract
from implementation.types import JsonObject


class PythonModuleInstanceAliasState:
    """Responsibilities: _module alias ownership_, _instance construction records_."""

    def __init__(self, reference_aliases: PythonReferenceAliasesContract) -> None:
        """Responsibilities: _module alias state initialization_."""
        self._aliases: dict[str, str] = {}
        self._reference_aliases: PythonReferenceAliasesContract = reference_aliases

    def resolved_alias(self, name: str) -> str:
        """Responsibilities: _class alias chain resolution_."""
        resolved = name
        seen: set[str] = set()
        while resolved in self._aliases and resolved not in seen:
            seen.add(resolved)
            resolved = self._aliases[resolved]
        return resolved

    def record(
        self,
        statement: PythonModuleInstanceStatementContract,
    ) -> None:
        """Responsibilities: _class alias state transition_."""
        target_values = statement.assignment_target_values(self._reference_aliases)
        if not target_values:
            return
        for target, target_value in target_values.items():
            if type(target_value) not in (ast.Name, ast.Attribute):
                self._aliases.pop(target, None)
                continue
            self._aliases.update({target: self.resolved_alias(ast.unparse(target_value))})

    def instance_records(self, value: ast.AST) -> list[JsonObject]:
        """Responsibilities: _module instance record construction_."""
        if type(value) is ast.Constant and value.value is None:
            return []
        records: list[JsonObject] = []
        for call in ast.walk(value):
            if type(call) is not ast.Call or type(call.func) not in (
                ast.Name,
                ast.Attribute,
            ):
                continue
            constructor = self.resolved_alias(ast.unparse(call.func))
            records.append({"line": call.lineno - 1, "constructor": constructor})
        return records
