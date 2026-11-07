from __future__ import annotations

import ast

from implementation.references.aliases.python_container_lookup import (
    PythonContainerLookup,
)
from implementation.references.protocols import PythonContainerLookupContract
from implementation.rules.constants import PYTHON_BUILTINS_MODULE, PYTHON_DICT_ATTRIBUTE
from implementation.types import PythonCallAliasEntries


class PythonCallAliasState:
    """Responsibilities: _invocation aliases_, _container values_."""

    _aliases: dict[str, PythonCallAliasEntries]
    _names: dict[str, ast.AST]

    def _key(self, value: ast.AST) -> str:
        """Responsibilities: _static key resolution_."""
        if type(value) is not ast.Constant:
            return ""
        if type(value.value) not in (str, int):
            return ""
        return str(value.value)

    def _literal_items(self, value: ast.Dict) -> dict[str, ast.AST]:
        """Responsibilities: _literal dictionary entry resolution_."""
        items: dict[str, ast.AST] = {}
        for key, item in zip(value.keys, value.values, strict=False):
            if key is None:
                continue
            name = self._key(key)
            if name:
                items[name] = item
        return items

    def _items(self, value: ast.AST) -> dict[str, ast.AST]:
        """Responsibilities: _container items resolution_."""
        if type(value) is ast.Name:
            return dict(self._aliases.get(value.id, {}))
        if type(value) is ast.Subscript:
            resolved = self.container_value(value)
            if not resolved.found():
                return {}
            return self._items(resolved.expression_node())
        if type(value) is not ast.Dict:
            return {}
        return self._literal_items(value)

    def _observe_assignment(self, node: ast.Assign) -> None:
        """Responsibilities: _assignment observation_."""
        if len(node.targets) != 1:
            return
        target = node.targets[0]
        if type(target) is not ast.Name:
            return
        if self._observe_builtin_subscript(node, target):
            return
        self._aliases.update({target.id: self._items(node.value)})

    def _builtin_dictionary_key(self, lookup: ast.Subscript) -> str:
        """Responsibilities: _builtin dictionary key resolution_."""
        owner = lookup.value
        if type(owner) is not ast.Attribute or owner.attr != PYTHON_DICT_ATTRIBUTE:
            return ""
        if type(owner.value) is not ast.Name or owner.value.id != PYTHON_BUILTINS_MODULE:
            return ""
        return self._key(lookup.slice)

    def _observe_builtin_subscript(self, node: ast.Assign, target: ast.Name) -> bool:
        """Responsibilities: _builtin alias observation_."""
        if type(node.value) is not ast.Subscript:
            return False
        key = self._builtin_dictionary_key(node.value)
        if not key:
            return False
        self._names.update({target.id: ast.Name(id=key, ctx=ast.Load())})
        return True

    def __init__(self) -> None:
        """Responsibilities: _call alias state initialization_."""
        self._aliases = {}
        self._names = {}

    def observe(self, node: ast.AST) -> None:
        """Responsibilities: _node observation_."""
        if type(node) is ast.Assign:
            self._observe_assignment(node)

    def observe_all(self, nodes: list[ast.AST]) -> None:
        """Responsibilities: _node batch observation_."""
        self._aliases.clear()
        self._names.clear()
        for node in nodes:
            self.observe(node)

    def container_value(self, value: ast.Subscript) -> PythonContainerLookupContract:
        """Responsibilities: _container value resolution_."""
        key = self._key(value.slice)
        if not key:
            return PythonContainerLookup(found_value=False, expression=value.slice)
        item = self._items(value.value).get(key)
        if item is None:
            return PythonContainerLookup(found_value=False, expression=value.slice)
        return PythonContainerLookup(found_value=True, expression=item)

    def named_value(self, name: str) -> PythonContainerLookupContract:
        """Responsibilities: _named alias resolution_."""
        value = self._names.get(name)
        if value is None:
            return PythonContainerLookup(found_value=False, expression=ast.Name(id=name))
        return PythonContainerLookup(found_value=True, expression=value)
