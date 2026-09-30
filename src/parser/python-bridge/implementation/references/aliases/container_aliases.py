from __future__ import annotations

import ast

from implementation.references.aliases.container_values import PythonContainerValues


class PythonContainerAliases:
    """Responsibilities: _Python container alias observation_."""

    def _record_static_alias(self, name: str, value: ast.AST) -> None:
        """Responsibilities: _static alias state tracking_."""
        static_key = self.values.keys.static_key(value)
        if static_key:
            self._static_aliases[name] = static_key
            return
        self._static_aliases.pop(name, None)

    def _record_container_alias(self, name: str, value: ast.AST) -> None:
        """Responsibilities: _container alias state tracking_."""
        if type(value) in (ast.Dict, ast.List, ast.Tuple):
            self._aliases[name] = self.values._items(value)
            return
        if type(value) is ast.Name:
            if value.id in self._aliases:
                self._aliases[name] = dict(self._aliases[value.id])
                return
        self._aliases.pop(name, None)

    def _record_target(self, target: ast.AST, value: ast.AST) -> None:
        """Responsibilities: _container alias target tracking_."""
        if type(target) is not ast.Name:
            return
        self._record_static_alias(target.id, value)
        self._record_container_alias(target.id, value)

    def _is_builtin_dictionary(self, value: ast.AST) -> bool:
        """Responsibilities: _builtins dictionary alias classification_."""
        if type(value) is ast.Attribute:
            if value.attr != "__dict__":
                return False
            if type(value.value) is not ast.Name:
                return False
            return value.value.id in self._module_names
        if type(value) is not ast.Name:
            return False
        return value.id in self._builtin_dictionary_aliases

    def _observe_import(self, node: ast.Import) -> None:
        """Responsibilities: _builtins import observation_."""
        for imported in node.names:
            if imported.name != "builtins":
                continue
            local_name = imported.name
            if imported.asname is not None:
                local_name = imported.asname
            self._module_names.add(local_name)

    def _update_dictionary_alias(self, target: ast.AST, value: ast.AST) -> None:
        """Responsibilities: _builtins dictionary alias observation_."""
        if type(target) is not ast.Name:
            return
        if self._is_builtin_dictionary(value):
            self._builtin_dictionary_aliases.add(target.id)
            return
        self._builtin_dictionary_aliases.discard(target.id)

    def _observe_assignment(self, targets: list[ast.AST], value: ast.AST) -> None:
        """Responsibilities: _container assignment observation_."""
        self.assign(targets, value)
        for target in targets:
            self._update_dictionary_alias(target, value)

    def __init__(self) -> None:
        """Responsibilities: _container alias state initialization_."""
        self._aliases: dict[str, dict[str, ast.AST]] = {}
        self._static_aliases: dict[str, str] = {}
        self._module_names: set[str] = {"builtins"}
        self._builtin_dictionary_aliases: set[str] = set()
        self.values: PythonContainerValues = PythonContainerValues(self)

    def static_alias(self, name: str) -> str:
        """Responsibilities: _static alias value resolution_."""
        return self._static_aliases.get(name, "")

    def clear(self) -> None:
        """Responsibilities: _container alias state reset_."""
        self._aliases.clear()
        self._static_aliases.clear()
        self._module_names.clear()
        self._module_names.add("builtins")
        self._builtin_dictionary_aliases.clear()

    def assign(self, targets: list[ast.AST], value: ast.AST) -> None:
        """Responsibilities: _container alias assignment tracking_."""
        for target in targets:
            self._record_target(target, value)

    def observe(self, node: ast.AST) -> None:
        """Responsibilities: _container assignment observation_."""
        if type(node) is ast.Import:
            self._observe_import(node)
            return
        if type(node) is ast.Assign:
            self._observe_assignment(node.targets, node.value)
            return
        if type(node) is ast.AnnAssign:
            if node.value is not None:
                self._observe_assignment([node.target], node.value)

    def observe_all(self, nodes: list[ast.AST]) -> None:
        """Responsibilities: _container assignment batch observation_."""
        self.clear()
        for node in nodes:
            self.observe(node)
