from __future__ import annotations

import ast

from implementation.ast.protocols import PythonAstNodeIndexContract


class PythonSysPathImportAliases:
    """Responsibilities: _sys import aliases_, _sys.path import aliases_."""

    def _import_system_aliases(self, node: ast.AST) -> None:
        """Responsibilities: _sys import aliases_."""
        if type(node) is not ast.Import:
            return
        for imported in node.names:
            if imported.name == "sys":
                self._system_names.add(imported.asname or imported.name)

    def _import_path_aliases(self, node: ast.AST) -> None:
        """Responsibilities: _sys.path import aliases_."""
        if type(node) is not ast.ImportFrom or node.module != "sys":
            return
        for imported in node.names:
            if imported.name == "path":
                self._path_names.add(imported.asname or imported.name)

    def __init__(self, node_index: PythonAstNodeIndexContract) -> None:
        """Responsibilities: _sys path alias state_."""
        self._node_index: PythonAstNodeIndexContract = node_index
        self._system_names: set[str] = {"sys"}
        self._path_names: set[str] = set()

    def observe_imports(self, tree: ast.AST) -> None:
        """Responsibilities: _import alias indexing_."""
        self._system_names.clear()
        self._system_names.add("sys")
        self._path_names.clear()
        for node in self._node_index.nodes(tree):
            self._import_system_aliases(node)
            self._import_path_aliases(node)

    def add_path_alias(self, alias: str) -> bool:
        """Responsibilities: _new path alias registration_."""
        if alias in self._path_names:
            return False
        self._path_names.add(alias)
        return True

    def system_name(self, name: str) -> bool:
        """Responsibilities: _sys alias lookup_."""
        return name in self._system_names

    def path_name(self, name: str) -> bool:
        """Responsibilities: _path alias lookup_."""
        return name in self._path_names
