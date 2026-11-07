from __future__ import annotations

import ast

from implementation.references.alias_types import (
    ContainerItemMap,
)
from implementation.references.aliases.python_container_lookup import (
    PythonContainerLookup,
)
from implementation.references.protocols import (
    PythonContainerAliasStateContract,
    PythonContainerKeysContract,
    PythonContainerLookupContract,
)
from implementation.rules.constants import PYTHON_BUILTINS_MODULE, PYTHON_DICT_ATTRIBUTE


class PythonContainerItems:
    """Responsibilities: _static container entries_, _container item lookup_."""

    def _dictionary_is_builtin(self, dictionary: ast.AST) -> bool:
        """Responsibilities: _builtin dictionary recognition_."""
        if type(dictionary) is ast.Attribute:
            if dictionary.attr != PYTHON_DICT_ATTRIBUTE:
                return False
            if type(dictionary.value) is not ast.Name:
                return False
            return dictionary.value.id in self._builtin_module_names
        if type(dictionary) is not ast.Name:
            return False
        return dictionary.id in self._builtin_dictionary_names

    def _observe_alias_target(self, target: ast.AST, value: ast.AST) -> None:
        """Responsibilities: _builtin dictionary alias tracking_."""
        if type(target) is not ast.Name:
            return
        recognized = self._dictionary_is_builtin(value)
        if recognized:
            self._builtin_dictionary_names.add(target.id)
            return
        self._builtin_dictionary_names.discard(target.id)

    def _dictionary_items(self, expression: ast.Dict) -> ContainerItemMap:
        """Responsibilities: _dictionary key indexing_."""
        items: ContainerItemMap = {}
        for key_node, item in zip(expression.keys, expression.values, strict=False):
            if key_node is None:
                continue
            key = self._keys.static_key(key_node)
            if key:
                items[key] = item
        return items

    def __init__(
        self,
        state: PythonContainerAliasStateContract,
        keys: PythonContainerKeysContract,
    ) -> None:
        """Responsibilities: _container item dependencies_."""
        self._state: PythonContainerAliasStateContract = state
        self._keys: PythonContainerKeysContract = keys
        self._builtin_module_names: set[str] = {PYTHON_BUILTINS_MODULE}
        self._builtin_dictionary_names: set[str] = set()

    def items(self, expression: ast.AST) -> ContainerItemMap:
        """Responsibilities: _static container entry collection_."""
        self._state.select_scope_node(expression)
        match expression:
            case ast.Name(id=name):
                return self._state.alias(name).values()
            case ast.Dict() as dictionary:
                return self._dictionary_items(dictionary)
            case (ast.List() | ast.Tuple() | ast.Set()) as sequence:
                return {str(index): item for index, item in enumerate(sequence.elts)}
            case _:
                return {}

    def item(self, container: ast.AST, key: str) -> PythonContainerLookupContract:
        """Responsibilities: _static container item resolution_."""
        match container:
            case ast.Name(id=name):
                return self._state.alias(name).item(key)
            case _:
                item = self.items(container).get(key)
        if item is None:
            return PythonContainerLookup(found_value=False, expression=container)
        return PythonContainerLookup(found_value=True, expression=item)

    def builtin_item(
        self,
        dictionary: ast.AST,
        key: str,
    ) -> PythonContainerLookupContract:
        """Responsibilities: _builtins dictionary item resolution_."""
        if not self._dictionary_is_builtin(dictionary):
            return PythonContainerLookup(found_value=False, expression=dictionary)
        if key == "":
            return PythonContainerLookup(found_value=False, expression=dictionary)
        return PythonContainerLookup(found_value=True, expression=ast.Name(id=key, ctx=ast.Load()))

    def reset(self) -> None:
        """Responsibilities: _builtin alias reset_."""
        self._builtin_module_names.clear()
        self._builtin_module_names.add(PYTHON_BUILTINS_MODULE)
        self._builtin_dictionary_names.clear()

    def observe_builtin_aliases(self, node: ast.AST) -> None:
        """Responsibilities: _builtin alias tracking_."""
        match node:
            case ast.Import(names=names):
                for alias in names:
                    if alias.name != PYTHON_BUILTINS_MODULE:
                        continue
                    if alias.asname is not None:
                        self._builtin_module_names.add(alias.asname)
                        continue
                    self._builtin_module_names.add(alias.name)
            case ast.Assign(targets=targets, value=value):
                for target in targets:
                    self._observe_alias_target(target, value)
            case ast.AnnAssign(target=target, value=value) if value is not None:
                self._observe_alias_target(target, value)
            case _:
                return
