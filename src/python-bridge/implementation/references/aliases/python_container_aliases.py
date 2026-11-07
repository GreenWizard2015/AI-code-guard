from __future__ import annotations

import ast

from implementation.references.alias_types import (
    ContainerItemMap,
)
from implementation.references.protocols import (
    PythonContainerAliasStateContract,
    PythonContainerItemsContract,
    PythonContainerKeysContract,
    PythonContainerValuesContract,
)


class PythonContainerAliases:
    """Responsibilities: _import aliases_, _scope aliases_."""

    def _container_alias_items(self, container_value: ast.AST) -> ContainerItemMap:
        """Responsibilities: _container alias item selection_."""
        if type(container_value) in (ast.Dict, ast.List, ast.Tuple):
            return self._items(container_value)
        if type(container_value) is ast.Name:
            return self._state.alias(container_value.id).values()
        return {}

    def _record_target(self, target: ast.AST, target_value: ast.AST) -> None:
        """Responsibilities: _container alias target tracking_."""
        if type(target) is not ast.Name:
            return
        static_value = self.container_keys().static_key(target_value)
        values = self._container_alias_items(target_value)
        self._state.select_scope_node(target)
        self._state.record_alias(target.id, static_value, values)

    def _dictionary_items(self, value: ast.Dict) -> ContainerItemMap:
        """Responsibilities: _dictionary item resolution_."""
        items: ContainerItemMap = {}
        for key_node, item in zip(value.keys, value.values, strict=False):
            if key_node is None:
                continue
            key = self.container_keys().static_key(key_node)
            if key:
                items[key] = item
        return items

    def _call_items(self, value: ast.Call) -> ContainerItemMap:
        """Responsibilities: _container constructor item mapping_."""
        if type(value.func) is not ast.Name:
            return {}
        if value.func.id not in {"list", "set", "tuple"}:
            return {}
        if len(value.args) != 1:
            return {}
        return self._items(value.args[0])

    def _resolved_items(self, nested_value: ast.AST) -> ContainerItemMap:
        """Responsibilities: _nested container item mapping_."""
        if type(nested_value) is ast.Subscript:
            resolved = self.container_values().container_value(nested_value)
            if not resolved.found():
                return {}
            return self._items(resolved.expression_node())
        if type(nested_value) is ast.Attribute:
            resolved = self.container_values().attribute_value(nested_value)
            if not resolved.found():
                return {}
            return self._items(resolved.expression_node())
        return {}

    def _literal_items(self, expression: ast.AST) -> ContainerItemMap:
        """Responsibilities: _literal container item mapping_."""
        if type(expression) is ast.Dict:
            return self._dictionary_items(expression)
        if type(expression) in (ast.List, ast.Tuple, ast.Set):
            return {str(index): item for index, item in enumerate(ast.iter_child_nodes(expression))}
        return {}

    def _items(self, container_expression: ast.AST) -> ContainerItemMap:
        """Responsibilities: _static container item collection_."""
        self._state.select_scope_node(container_expression)
        if type(container_expression) is ast.Name:
            return self._state.alias(container_expression.id).values()
        if type(container_expression) in (ast.Dict, ast.List, ast.Tuple, ast.Set):
            return self._literal_items(container_expression)
        if type(container_expression) is ast.Call:
            return self._call_items(container_expression)
        if type(container_expression) in (ast.Subscript, ast.Attribute):
            return self._resolved_items(container_expression)
        return {}

    def _observe_assignment(self, node: ast.AST) -> None:
        """Responsibilities: _assignment alias observation_."""
        if type(node) is ast.Assign:
            self._container_items.observe_builtin_aliases(node)
            for target in node.targets:
                self._record_target(target, node.value)
            return
        if type(node) is not ast.AnnAssign or node.value is None:
            return
        self._container_items.observe_builtin_aliases(node)
        self._record_target(node.target, node.value)

    def __init__(
        self,
        state: PythonContainerAliasStateContract,
        keys: PythonContainerKeysContract,
        values: PythonContainerValuesContract,
        items: PythonContainerItemsContract,
    ) -> None:
        """Responsibilities: _container alias state binding_."""
        self._state: PythonContainerAliasStateContract = state
        self._values: PythonContainerValuesContract = values
        self._keys: PythonContainerKeysContract = keys
        self._container_items: PythonContainerItemsContract = items

    def state(self) -> PythonContainerAliasStateContract:
        """Responsibilities: _container alias state access_."""
        return self._state

    def container_values(self) -> PythonContainerValuesContract:
        """Responsibilities: _container value access_."""
        return self._values

    def container_keys(self) -> PythonContainerKeysContract:
        """Responsibilities: _container key access_."""
        return self._keys

    def clear(self) -> None:
        """Responsibilities: _container alias state reset_."""
        self._state.clear()
        self._container_items.reset()

    def observe(self, node: ast.AST) -> None:
        """Responsibilities: _container assignment observation_."""
        self._state.select_scope_node(node)
        if type(node) is ast.Import:
            self._container_items.observe_builtin_aliases(node)
            return
        if type(node) is ast.Assign or type(node) is ast.AnnAssign:
            self._observe_assignment(node)

    def observe_all(self, nodes: list[ast.AST], tree: ast.AST) -> None:
        """Responsibilities: _container assignment batch observation_."""
        self.clear()
        self._state.configure_scope_tree(tree)
        alias_nodes = self._state.node_index().alias_event_nodes(tree, nodes)
        for node in alias_nodes:
            self.observe(node)
        if nodes:
            self._state.select_scope_node(nodes[-1])
