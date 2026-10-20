from __future__ import annotations

import ast

from implementation.rules.constants import PYTHON_BUILTINS_MODULE
from implementation.references.protocols import (
    PythonContainerAliasStateContract,
    PythonContainerKeysContract,
    PythonContainerValuesContract,
)
from implementation.ast.protocols import PythonAstNodeIndexContract


class PythonContainerAliases:
    """Responsibilities: _import aliases_, _scope aliases_."""

    def _record_static_alias(self, name: str, value: ast.AST) -> None:
        """Responsibilities: _static alias state tracking_."""
        static_key = self.container_keys.static_key(value)
        aliases = self._state.static_aliases.setdefault(
            self._state.scope["current"], {}
        )
        if static_key:
            aliases[name] = static_key
            return
        aliases[name] = ""

    def _record_container_alias(self, name: str, value: ast.AST) -> None:
        """Responsibilities: _container alias state tracking_."""
        aliases = self._state.aliases.setdefault(self._state.scope["current"], {})
        if type(value) in (ast.Dict, ast.List, ast.Tuple):
            aliases[name] = self._items(value)
            return
        if type(value) is ast.Name:
            aliases[name] = self._state.container_alias(value.id)
            return
        aliases[name] = {}

    def _record_target(self, target: ast.AST, value: ast.AST) -> None:
        """Responsibilities: _container alias target tracking_."""
        if type(target) is not ast.Name:
            return
        self._record_static_alias(target.id, value)
        self._record_container_alias(target.id, value)

    def _observe_import(self, node: ast.Import) -> None:
        """Responsibilities: _builtins import observation_."""
        for imported in node.names:
            if imported.name != PYTHON_BUILTINS_MODULE:
                continue
            local_name = imported.name
            if imported.asname is not None:
                local_name = imported.asname
            self._state.module_names.add(local_name)

    def _update_dictionary_alias(self, target: ast.AST, value: ast.AST) -> None:
        """Responsibilities: _builtins dictionary alias observation_."""
        if type(target) is not ast.Name:
            return
        if self._state.builtin_dictionary(value):
            self._state.builtin_dictionary_aliases.add(target.id)
            return
        self._state.builtin_dictionary_aliases.discard(target.id)

    def _observe_assignment(self, targets: list[ast.AST], value: ast.AST) -> None:
        """Responsibilities: _container assignment observation_."""
        self.assign(targets, value)
        for target in targets:
            self._update_dictionary_alias(target, value)

    def _dictionary_items(self, value: ast.Dict) -> dict[str, ast.AST]:
        """Responsibilities: _dictionary item resolution_."""
        items: dict[str, ast.AST] = {}
        for key_node, item in zip(value.keys, value.values):
            if key_node is None:
                continue
            key = self.container_keys.static_key(key_node)
            if key:
                items[key] = item
        return items

    def _call_items(self, value: ast.Call) -> dict[str, ast.AST]:
        """Responsibilities: _container constructor item mapping_."""
        if type(value.func) is not ast.Name:
            return {}
        if value.func.id not in {"list", "set", "tuple"}:
            return {}
        if len(value.args) != 1:
            return {}
        return self._items(value.args[0])

    def _resolved_items(self, value: ast.AST) -> dict[str, ast.AST]:
        """Responsibilities: _nested container item mapping_."""
        if type(value) is ast.Subscript:
            resolved = self.container_values.container_value(value)
        else:
            resolved = self.container_values.attribute_value(value)
        if not resolved.found():
            return {}
        return self._items(resolved.expression_node())

    def _items(self, value: ast.AST) -> dict[str, ast.AST]:
        """Responsibilities: _static container item collection_."""
        self._state.select_scope_node(value)
        if type(value) is ast.Name:
            return self._state.container_alias(value.id)
        if type(value) is ast.Dict:
            return self._dictionary_items(value)
        if type(value) in (ast.List, ast.Tuple, ast.Set):
            return {str(index): item for index, item in enumerate(value.elts)}
        if type(value) is ast.Call:
            return self._call_items(value)
        if type(value) in (ast.Subscript, ast.Attribute):
            return self._resolved_items(value)
        return {}

    def _configure_scope_tree(self, tree: ast.AST) -> None:
        """Responsibilities: _shared lexical scope_."""
        scopes = self._node_index.scopes(tree)
        if not scopes:
            raise ValueError("Python AST scope index cannot be empty.")
        self._state.node_scopes = scopes
        self._state.scope["current"] = "module"

    def __init__(
        self,
        state: PythonContainerAliasStateContract,
        keys: PythonContainerKeysContract,
        values: PythonContainerValuesContract,
        node_index: PythonAstNodeIndexContract,
    ) -> None:
        """Responsibilities: _container alias state binding_."""
        self._state: PythonContainerAliasStateContract = state
        self.container_keys: PythonContainerKeysContract = keys
        self.container_values: PythonContainerValuesContract = values
        self._node_index: PythonAstNodeIndexContract = node_index

    def clear(self) -> None:
        """Responsibilities: _container alias state reset_."""
        self._state.aliases.clear()
        self._state.aliases["module"] = {}
        self._state.static_aliases.clear()
        self._state.static_aliases["module"] = {}
        self._state.scope["current"] = "module"
        self._state.module_names.clear()
        self._state.module_names.add(PYTHON_BUILTINS_MODULE)
        self._state.builtin_dictionary_aliases.clear()

    def assign(self, targets: list[ast.AST], value: ast.AST) -> None:
        """Responsibilities: _container alias assignment tracking_."""
        for target in targets:
            self._record_target(target, value)

    def observe(self, node: ast.AST) -> None:
        """Responsibilities: _container assignment observation_."""
        self._state.select_scope_node(node)
        if type(node) is ast.Import:
            self._observe_import(node)
            return
        if type(node) is ast.Assign:
            self._observe_assignment(node.targets, node.value)
            return
        if type(node) is ast.AnnAssign and node.value is not None:
            self._observe_assignment([node.target], node.value)

    def observe_all(self, nodes: list[ast.AST], tree: ast.AST) -> None:
        """Responsibilities: _container assignment batch observation_."""
        self.clear()
        self._configure_scope_tree(tree)
        for node in nodes:
            self.observe(node)
