from __future__ import annotations

import ast
from typing import Any

from implementation.references.aliases.reference_aliases import PythonReferenceAliases
from implementation.types import JsonObject


class PythonModuleInstanceCollector:
    """Responsibilities: _Python module instances collection_."""

    def _main_guard(self, node: ast.AST) -> bool:
        """Responsibilities: _main guard classification_."""
        if type(node) is not ast.If or type(node.test) is not ast.Compare:
            return False
        if len(node.test.ops) != 1 or type(node.test.ops[0]) is not ast.Eq:
            return False
        if type(node.test.left) is not ast.Name or node.test.left.id != "__name__":
            return False
        if len(node.test.comparators) != 1:
            return False
        comparator = node.test.comparators[0]
        return type(comparator) is ast.Constant and comparator.value == "__main__"

    def _module_statement_nodes(self, nodes: list[ast.AST]) -> list[ast.stmt]:
        """Responsibilities: _module statement traversal_."""
        statements: list[ast.stmt] = []
        excluded = (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef, ast.Lambda)
        for node in nodes:
            if type(node) in excluded:
                continue
            if ast.stmt in type(node).__mro__:
                statements.append(node)
            if self._main_guard(node):
                continue
            for child in ast.iter_child_nodes(node):
                if ast.expr in type(child).__mro__ or type(child) in excluded:
                    continue
                statements.extend(self._module_statement_nodes([child]))
        return statements

    def _assignment_target_values(self, node: ast.AST) -> dict[str, ast.AST]:
        """Responsibilities: _assignment target value extraction_."""
        if type(node) is ast.Assign and len(node.targets) == 1:
            return self.reference_aliases.target_values(node.targets[0], node.value)
        if type(node) is ast.AnnAssign and node.value is not None:
            return self.reference_aliases.target_values(node.target, node.value)
        return {}

    def _alias_source_name(self, value: ast.AST) -> str:
        """Responsibilities: _class alias source extraction_."""
        if type(value) not in (ast.Name, ast.Attribute):
            return ""
        return ast.unparse(value)

    def _resolved_alias(self, name: str, aliases: dict[str, str]) -> str:
        """Responsibilities: _class alias chain resolution_."""
        resolved = name
        seen: set[str] = set()
        while resolved in aliases and resolved not in seen:
            seen.add(resolved)
            resolved = aliases[resolved]
        return resolved

    def _record_alias(self, node: ast.AST, aliases: dict[str, str]) -> None:
        """Responsibilities: _class alias state tracking_."""
        target_values = self._assignment_target_values(node)
        if not target_values:
            return
        for target, target_value in target_values.items():
            source = self._alias_source_name(target_value)
            if not source:
                aliases.pop(target, None)
                continue
            aliases[target] = self._resolved_alias(source, aliases)

    def _instance_records(
        self, node: ast.AST, value: ast.AST, aliases: dict[str, str]
    ) -> list[JsonObject]:
        """Responsibilities: _module instance record construction_."""
        if type(value) is ast.Constant and value.value is None:
            return []
        records: list[JsonObject] = []
        for call in ast.walk(value):
            if type(call) is not ast.Call:
                continue
            constructor = self.instance_constructor_name(call)
            if not constructor:
                continue
            constructor = self._resolved_alias(constructor, aliases)
            records.append({"line": call.lineno - 1, "constructor": constructor})
        return records

    def __init__(self, tree: ast.Module) -> None:
        """Responsibilities: _module instance source initialization_."""
        self.tree: ast.Module = tree
        self.reference_aliases: PythonReferenceAliases = PythonReferenceAliases()

    def assignment_value(self, node: ast.AST) -> ast.expr:
        """Responsibilities: _assignment value identification_."""
        if type(node) is ast.Assign:
            return node.value
        if type(node) is ast.AnnAssign:
            return node.value
        return ast.Constant(value=None)

    def instance_constructor_name(self, value: ast.Call) -> str:
        """Responsibilities: _module constructor name extraction_."""
        if type(value.func) not in (ast.Name, ast.Attribute):
            return ""
        return ast.unparse(value.func)

    def collect(self) -> list[JsonObject]:
        """Responsibilities: _module instances extraction_."""
        instances: list[JsonObject] = []
        aliases: dict[str, str] = {}
        for node in self._module_statement_nodes(list(self.tree.body)):
            if type(node) is ast.AnnAssign and node.value is None:
                continue
            value: Any = self.assignment_value(node)
            self._record_alias(node, aliases)
            instances.extend(self._instance_records(node, value, aliases))
        return instances
