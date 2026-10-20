from __future__ import annotations

import ast

from implementation.references.protocols import (
    PythonContainerKeysContract,
    PythonExceptionAliasSnapshotContract,
)
from implementation.references.protocols import (
    PythonContainerValuesContract,
)
from implementation.rules.constants import (
    PYTHON_BASE_EXCEPTION_NAME,
    PYTHON_BUILTINS_MODULE,
    PYTHON_EXCEPTION_NAME,
    PYTHON_GETATTR_FUNCTION,
)
from implementation.rules.python_syntax.exceptions.python_exception_alias_snapshot import (
    PythonExceptionAliasSnapshot,
)


class PythonExceptionBroadness:
    """Responsibilities: _exception alias observation_, _broad type resolution_."""

    def _imported_exception(self, node: ast.ImportFrom) -> None:
        """Responsibilities: _imported exception aliases_."""
        if node.module != PYTHON_BUILTINS_MODULE:
            return
        for imported in node.names:
            if imported.name not in {PYTHON_EXCEPTION_NAME, PYTHON_BASE_EXCEPTION_NAME}:
                continue
            local_name = imported.name
            if imported.asname is not None:
                local_name = imported.asname
            self._broad_exception_names.add(local_name)

    def _imported_module(self, node: ast.Import) -> None:
        """Responsibilities: _imported builtin aliases_."""
        for imported in node.names:
            if imported.name != PYTHON_BUILTINS_MODULE:
                continue
            local_name = imported.name
            if imported.asname is not None:
                local_name = imported.asname
            self._module_names.add(local_name)

    def _tuple_broad(self, value: ast.AST) -> bool:
        """Responsibilities: _tuple exception classification_."""
        if type(value) is ast.Call:
            return self._tuple_constructor_broad(value)
        if type(value) is ast.List:
            return self._sequence_broad(value.elts)
        if type(value) is not ast.Tuple:
            return False
        return self._tuple_items_broad(value.elts)

    def _tuple_constructor_broad(self, value: ast.Call) -> bool:
        """Responsibilities: _tuple constructor classification_."""
        if type(value.func) is not ast.Name:
            return False
        if value.func.id != "tuple" or len(value.args) != 1:
            return False
        return self._tuple_broad(value.args[0])

    def _tuple_items_broad(self, values: list[ast.AST]) -> bool:
        """Responsibilities: _tuple item classification_."""
        for item in values:
            if type(item) is ast.Starred:
                if self._exception_value_broad(item.value):
                    return True
                continue
            if self._exception_value_broad(item):
                return True
        return False

    def _sequence_broad(self, values: list[ast.AST]) -> bool:
        """Responsibilities: _sequence exception classification_."""
        for value in values:
            if self._exception_value_broad(value):
                return True
        return False

    def _exception_value_broad(self, value: ast.AST) -> bool:
        """Responsibilities: _nested exception classification_."""
        if self.broad(value):
            return True
        return self._tuple_broad(value)

    def _broad_getattr(self, value: ast.Call) -> bool:
        """Responsibilities: _reflected exception classification_."""
        if type(value.func) is not ast.Name:
            return False
        if value.func.id != PYTHON_GETATTR_FUNCTION:
            return False
        if len(value.args) < 2:
            return False
        target = value.args[0]
        if type(target) is not ast.Name:
            return False
        if target.id not in self._module_names:
            return False
        name = self.container_keys.static_key(value.args[1])
        return name in self._broad_exception_names

    def _broad_attribute(self, value: ast.Attribute) -> bool:
        """Responsibilities: _qualified exception classification_."""
        target = value.value
        if type(target) is not ast.Name:
            return False
        if target.id not in self._module_names:
            return False
        return value.attr in self._broad_exception_names

    def _broad_subscript(self, value: ast.Subscript) -> bool:
        """Responsibilities: _subscript exception classification_."""
        resolved = self.container_values.container_value(value)
        if not resolved.found():
            return False
        return self.broad(resolved.expression_node())

    def __init__(
        self,
        container_keys: PythonContainerKeysContract,
        container_values: PythonContainerValuesContract,
    ) -> None:
        """Responsibilities: _broad exception state_."""
        self._broad_exception_names: set[str] = {
            PYTHON_EXCEPTION_NAME,
            PYTHON_BASE_EXCEPTION_NAME,
        }
        self._module_names: set[str] = {PYTHON_BUILTINS_MODULE}
        self.container_keys: PythonContainerKeysContract = container_keys
        self.container_values: PythonContainerValuesContract = container_values

    def observe(self, node: ast.AST) -> None:
        """Responsibilities: _exception import observation_."""
        if type(node) is ast.ImportFrom and node.module == PYTHON_BUILTINS_MODULE:
            self._imported_exception(node)
        if type(node) is ast.Import:
            self._imported_module(node)

    def observe_alias(self, source: str, target: str, broad: bool = False) -> None:
        """Responsibilities: _exception alias observation_."""
        source_is_module = source in self._module_names
        source_is_broad = source in self._broad_exception_names
        self._module_names.discard(target)
        self._broad_exception_names.discard(target)
        if source_is_module:
            self._module_names.add(target)
        if source_is_broad:
            self._broad_exception_names.add(target)
        if broad:
            self._broad_exception_names.add(target)

    def broad(self, value: ast.AST) -> bool:
        """Responsibilities: _broad exception lookup_."""
        if type(value) is ast.Name:
            return value.id in self._broad_exception_names
        if type(value) is ast.Call:
            if self._tuple_broad(value):
                return True
            return self._broad_getattr(value)
        if type(value) is ast.Attribute:
            return self._broad_attribute(value)
        if type(value) in (ast.Tuple, ast.List):
            return self._tuple_broad(value)
        if type(value) is ast.Subscript:
            return self._broad_subscript(value)
        return False

    def snapshot(
        self, multi_names: frozenset[str]
    ) -> PythonExceptionAliasSnapshotContract:
        """Responsibilities: _exception alias snapshot_."""
        return PythonExceptionAliasSnapshot(
            frozenset(self._broad_exception_names),
            frozenset(self._module_names),
            multi_names,
        )

    def restore_snapshot(self, snapshot: PythonExceptionAliasSnapshotContract) -> None:
        """Responsibilities: _exception alias restoration_."""
        self._broad_exception_names.clear()
        self._broad_exception_names.update(snapshot.exception_names())
        self._module_names.clear()
        self._module_names.update(snapshot.module_names())
