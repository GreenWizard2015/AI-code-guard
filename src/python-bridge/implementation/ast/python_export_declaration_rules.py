from __future__ import annotations

import ast

from implementation.ast.protocols import PythonAstNodeIndexContract
from implementation.types import JsonObject


class PythonExportDeclarationRules:
    """Responsibilities: _export declaration validation_, _invalid export reporting_."""

    _tree: ast.Module
    _node_index: PythonAstNodeIndexContract

    def _literal_export_value(self, value: ast.expr) -> bool:
        """Responsibilities: _literal export value validation_."""
        if type(value) is not ast.List:
            return False
        return all(not (type(item) is not ast.Constant or type(item.value) is not str) for item in value.elts)

    def _reference_issues(
        self,
        statement: ast.stmt,
        reported_lines: set[int],
    ) -> list[JsonObject]:
        """Responsibilities: _invalid export reference reporting_."""
        issues: list[JsonObject] = []
        for node in self._node_index.nodes(statement):
            if type(node) is not ast.Name or node.id != "__all__":
                continue
            line = node.lineno - 1
            if line in reported_lines:
                continue
            reported_lines.add(line)
            issues.append({"kind": "python-all-list-assignment", "line": line})
        return issues

    def __init__(self, tree: ast.Module, node_index: PythonAstNodeIndexContract) -> None:
        """Responsibilities: _export declaration rule initialization_."""
        self._tree = tree
        self._node_index = node_index

    def valid_assignment(self, statement: ast.stmt) -> bool:
        """Responsibilities: _literal export declaration classification_."""
        if type(statement) is not ast.Assign:
            return False
        if len(statement.targets) != 1:
            return False
        target = statement.targets[0]
        if type(target) is not ast.Name or target.id != "__all__":
            return False
        return self._literal_export_value(statement.value)

    def issues(self) -> list[JsonObject]:
        """Responsibilities: _export declaration diagnostics_."""
        reported_lines: set[int] = set()
        issues: list[JsonObject] = []
        for statement in self._tree.body:
            if self.valid_assignment(statement):
                continue
            issues.extend(self._reference_issues(statement, reported_lines))
        return issues
