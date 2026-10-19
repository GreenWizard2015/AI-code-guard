from __future__ import annotations

import ast
from typing import Any

from implementation.protocols import PythonAstNodeIndexContract
from implementation.types import JsonObject


class PythonImportNodes:
    """Responsibilities: _import record normalization_, _module import indexing_."""

    def __init__(
        self, tree: ast.Module, node_index: PythonAstNodeIndexContract
    ) -> None:
        """Responsibilities: _initialization import node collection_."""
        self.tree: ast.Module = tree
        self.node_index: PythonAstNodeIndexContract = node_index

    def import_record(self, node: ast.ImportFrom) -> JsonObject:
        """Responsibilities: _import record normalization_."""
        names: list[dict[str, str]] = []
        for item in node.names:
            name: Any = {"name": item.name, "alias": item.asname or ""}
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
        for node in self.node_index.nodes(self.tree):
            if type(node) is ast.ImportFrom:
                imports.append(self.import_record(node))
                continue
            if type(node) is not ast.Import:
                continue
            for item in node.names:
                name: Any = {"name": item.name, "alias": item.asname or ""}
                imports.append(
                    {
                        "line": node.lineno - 1,
                        "kind": "import",
                        "module": item.name,
                        "names": [name],
                    }
                )
        return imports
