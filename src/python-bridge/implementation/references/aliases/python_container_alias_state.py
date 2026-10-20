from __future__ import annotations

import ast
from implementation.rules.constants import PYTHON_BUILTINS_MODULE, PYTHON_DICT_ATTRIBUTE
from implementation.references.protocols import PythonContainerLookupContract
from implementation.references.aliases.python_container_lookup import (
    PythonContainerLookup,
)


class PythonContainerAliasState:
    """Responsibilities: _lexical scope tracking_, _container alias lookup_."""

    def __init__(self) -> None:
        """Responsibilities: _container alias state initialization_."""
        self.aliases: dict[str, dict[str, dict[str, ast.AST]]] = {"module": {}}
        self.static_aliases: dict[str, dict[str, str]] = {"module": {}}
        self.node_scopes: dict[ast.AST, str] = {}
        self.scope: dict[str, str] = {"current": "module"}
        self.module_names: set[str] = {PYTHON_BUILTINS_MODULE}
        self.builtin_dictionary_aliases: set[str] = set()

    def select_scope_node(self, node: ast.AST) -> None:
        """Responsibilities: _lexical alias scope selection_."""
        scope = self.node_scopes.get(node)
        if scope is None:
            self.scope["current"] = "module"
            return
        self.scope["current"] = scope

    def static_alias(self, name: str) -> str:
        """Responsibilities: _static alias value resolution_."""
        current_scope = self.scope["current"]
        current = self.static_aliases.get(current_scope, {})
        if current_scope != "module" and name in current:
            return current[name]
        return self.static_aliases.get("module", {}).get(name, "")

    def container_alias(self, name: str) -> dict[str, ast.AST]:
        """Responsibilities: _container alias value resolution_."""
        current_scope = self.scope["current"]
        current = self.aliases.get(current_scope, {})
        if current_scope != "module" and name in current:
            return dict(current[name])
        return dict(self.aliases.get("module", {}).get(name, {}))

    def container_item(self, name: str, key: str) -> PythonContainerLookupContract:
        """Responsibilities: _single container item resolution_."""
        current_scope = self.scope["current"]
        current = self.aliases.get(current_scope, {})
        if current_scope != "module" and name in current:
            item = current[name].get(key)
        else:
            item = self.aliases.get("module", {}).get(name, {}).get(key)
        if item is None:
            return PythonContainerLookup(False, ast.Name(id=key, ctx=ast.Load()))
        return PythonContainerLookup(True, item)

    def builtin_dictionary(self, value: ast.AST) -> bool:
        """Responsibilities: _builtins dictionary alias classification_."""
        if type(value) is ast.Attribute:
            if value.attr != PYTHON_DICT_ATTRIBUTE:
                return False
            if type(value.value) is not ast.Name:
                return False
            return value.value.id in self.module_names
        if type(value) is not ast.Name:
            return False
        return value.id in self.builtin_dictionary_aliases
