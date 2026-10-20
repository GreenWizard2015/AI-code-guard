from __future__ import annotations

import ast


class PythonSysPathImportAliases:
    """Responsibilities: _sys import aliases_, _sys.path import aliases_."""

    def _import_system_aliases(self, node: ast.AST) -> None:
        """Responsibilities: _sys import aliases_."""
        if type(node) is not ast.Import:
            return
        for imported in node.names:
            if imported.name == "sys":
                self.system_names.add(imported.asname or imported.name)

    def _import_path_aliases(self, node: ast.AST) -> None:
        """Responsibilities: _sys.path import aliases_."""
        if type(node) is not ast.ImportFrom or node.module != "sys":
            return
        for imported in node.names:
            if imported.name == "path":
                self.path_names.add(imported.asname or imported.name)

    def __init__(self) -> None:
        """Responsibilities: _sys path alias state_."""
        self.system_names: set[str] = {"sys"}
        self.path_names: set[str] = set()

    def observe_imports(self, nodes: list[ast.AST]) -> None:
        """Responsibilities: _import alias indexing_."""
        self.system_names.clear()
        self.system_names.add("sys")
        self.path_names.clear()
        for node in nodes:
            self._import_system_aliases(node)
            self._import_path_aliases(node)

    def add_path_alias(self, name: str) -> bool:
        """Responsibilities: _new path alias registration_."""
        if name in self.path_names:
            return False
        self.path_names.add(name)
        return True

    def system_name(self, name: str) -> bool:
        """Responsibilities: _sys alias lookup_."""
        return name in self.system_names

    def path_name(self, name: str) -> bool:
        """Responsibilities: _path alias lookup_."""
        return name in self.path_names
