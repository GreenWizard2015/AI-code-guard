from __future__ import annotations

import ast

from implementation.ast.protocols import PythonAstNodeIndexContract
from implementation.types import JsonObject, JsonValueList


class PythonImportNodes:
    """Responsibilities: _import record normalization_, _module import indexing_."""

    def _named_import_records(self, node: ast.Import) -> list[JsonObject]:
        """Responsibilities: _plain import record collection_."""
        records: list[JsonObject] = []
        for item in node.names:
            name: JsonObject = {"name": item.name, "alias": item.asname or ""}
            records.append(
                {
                    "line": node.lineno - 1,
                    "kind": "import",
                    "module": item.name,
                    "names": [name],
                },
            )
        return records

    def _statement_import_records(self, node: ast.AST) -> list[JsonObject]:
        """Responsibilities: _import statement record selection_."""
        if type(node) is ast.ImportFrom:
            return [self.import_record(node)]
        if type(node) is ast.Import:
            return self._named_import_records(node)
        return []

    def __init__(
        self,
        tree: ast.Module,
        node_index: PythonAstNodeIndexContract,
    ) -> None:
        """Responsibilities: _import node collection initialization_."""
        self._tree: ast.Module = tree
        self._node_index: PythonAstNodeIndexContract = node_index

    def import_record(self, node: ast.ImportFrom) -> JsonObject:
        """Responsibilities: _import record normalization_."""
        names: JsonValueList = []
        for item in node.names:
            name: JsonObject = {"name": item.name, "alias": item.asname or ""}
            names.append(name)
        module_name = node.module or ""
        return {
            "line": node.lineno - 1,
            "kind": "from",
            "module": ("." * node.level) + module_name,
            "names": names,
        }

    def import_records(self) -> list[JsonObject]:
        """Responsibilities: _module declarations_."""
        imports: list[JsonObject] = []
        for node in self._node_index.nodes(self._tree):
            imports.extend(self._statement_import_records(node))
        return imports
