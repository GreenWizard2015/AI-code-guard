from __future__ import annotations

import ast
from typing import Any

from implementation.protocols import PythonAstNodeIndexContract
from implementation.references.aliases.protocols import (
    PythonContainerAliasesContract,
    PythonReferenceAliasesContract,
)
from implementation.references.aliases.python_container_keys import PythonContainerKeys
from implementation.types import JsonObject
from implementation.rules.constants import (
    PYTHON_DICT_ATTRIBUTE,
    PYTHON_INIT_METHOD,
    PYTHON_POST_INIT_METHOD,
)


class PythonFieldMutationCollector:
    """Responsibilities: _mutable field assignments identification_, _mutation diagnostics collection_."""

    def _enclosing_method(
        self, node: ast.AST, parents: dict[int, ast.AST]
    ) -> list[ast.AST]:
        """Responsibilities: _enclosing callable lookup_."""
        parent: Any = parents.get(id(node))
        while parent is not None:
            if type(parent) in (ast.FunctionDef, ast.AsyncFunctionDef):
                return [parent]
            parent: Any = parents.get(id(parent))
        return []

    def _assignment_targets(self, node: ast.AST) -> list[ast.AST]:
        """Responsibilities: _assignment targets extraction_."""
        if type(node) is ast.Assign:
            return node.targets
        if type(node) is ast.AnnAssign:
            return [node.target]
        if type(node) is ast.AugAssign:
            return [node.target]
        return []

    def _append_alias(self, aliases: set[str], target: ast.AST, value: ast.AST) -> bool:
        """Responsibilities: _self alias chain extension_."""
        changed = False
        for target_name, target_value in self.assignment_aliases.target_values(
            target, value
        ).items():
            if type(target_value) is not ast.Name:
                continue
            if target_value.id not in aliases:
                continue
            if target_name in aliases:
                continue
            aliases.add(target_name)
            changed = True
        return changed

    def _append_assign_alias(self, aliases: set[str], node: ast.Assign) -> bool:
        """Responsibilities: _simple assignment alias handling_."""
        if len(node.targets) != 1:
            return False
        return self._append_alias(aliases, node.targets[0], node.value)

    def _append_annotated_alias(self, aliases: set[str], node: ast.AnnAssign) -> bool:
        """Responsibilities: _annotated assignment alias handling_."""
        if node.value is None:
            return False
        return self._append_alias(aliases, node.target, node.value)

    def _append_self_alias(self, aliases: set[str], node: ast.AST) -> bool:
        """Responsibilities: _self alias assignment identification_."""
        if type(node) is ast.Assign:
            return self._append_assign_alias(aliases, node)
        if type(node) is ast.AnnAssign:
            return self._append_annotated_alias(aliases, node)
        return False

    def _method_self_aliases(self, method: ast.AST) -> set[str]:
        """Responsibilities: _self alias chain collection_."""
        aliases = {"self"}
        changed = True
        while changed:
            changed = False
            for item in self.node_index.nodes(method):
                methods = self._enclosing_method(item, self.parents)
                if not any(candidate is method for candidate in methods):
                    continue
                if self._append_self_alias(aliases, item):
                    changed = True
        return aliases

    def _attribute_target(self, target: ast.Attribute, aliases: set[str]) -> bool:
        """Responsibilities: _attribute field target classification_."""
        if type(target.value) is not ast.Name:
            return False
        return target.value.id in aliases

    def _dictionary_target(
        self, target: ast.Subscript, value: ast.Attribute, aliases: set[str]
    ) -> bool:
        """Responsibilities: _dictionary field target classification_."""
        if value.attr != PYTHON_DICT_ATTRIBUTE:
            return False
        if type(value.value) is not ast.Name:
            return False
        if value.value.id not in aliases:
            return False
        return True

    def _vars_target(
        self, target: ast.Subscript, value: ast.Call, aliases: set[str]
    ) -> bool:
        """Responsibilities: _vars field target classification_."""
        if type(value.func) is not ast.Name:
            return False
        if value.func.id != "vars":
            return False
        if len(value.args) != 1:
            return False
        owner = value.args[0]
        if type(owner) is not ast.Name:
            return False
        if owner.id not in aliases:
            return False
        return True

    def __init__(
        self,
        tree: ast.AST,
        node_index: PythonAstNodeIndexContract,
        container_aliases: PythonContainerAliasesContract,
        assignment_aliases: PythonReferenceAliasesContract,
    ) -> None:
        """Responsibilities: _AST parent indexes initialization_."""
        self.tree: Any = tree
        self.node_index: Any = node_index
        self.container_aliases: PythonContainerAliasesContract = container_aliases
        self.container_keys: PythonContainerKeys = self.container_aliases.container_keys
        self.parents: dict[int, ast.AST] = {}
        self.method_aliases: dict[ast.AST, set[str]] = {}
        self.assignment_aliases: PythonReferenceAliasesContract = assignment_aliases

    def prepare(self) -> None:
        """Responsibilities: _field mutation traversal preparation_."""
        self.container_aliases.observe_all(self.node_index.nodes(self.tree), self.tree)
        self.prepare_parent_index()

    def prepare_parent_index(self) -> None:
        """Responsibilities: _field mutation parent index_."""
        self.parents.clear()
        self.method_aliases.clear()
        for node in self.node_index.nodes(self.tree):
            for child in self.node_index.children(node):
                self.parents[id(child)] = node

    def field_target(self, target: ast.AST, aliases: set[str]) -> bool:
        """Responsibilities: _self field targets identification_."""
        if type(target) is ast.Attribute:
            return self._attribute_target(target, aliases)
        if type(target) is not ast.Subscript:
            return False
        value = target.value
        if type(value) is ast.Attribute:
            return self._dictionary_target(target, value, aliases)
        if type(value) is not ast.Call:
            return False
        return self._vars_target(target, value, aliases)

    def collect_mutations(self, node: ast.AST) -> list[JsonObject]:
        """Responsibilities: _collection mutable field assignment_."""
        methods: Any = self._enclosing_method(node, self.parents)
        for method in methods:
            if method.name in {PYTHON_INIT_METHOD, PYTHON_POST_INIT_METHOD}:
                return []
            aliases = self.method_aliases.get(method)
            if aliases is None:
                aliases = self._method_self_aliases(method)
                self.method_aliases[method] = aliases
            if any(
                self.field_target(target, aliases)
                for target in self._assignment_targets(node)
            ):
                return [{"line": node.lineno - 1, "kind": "mutable-field-assignment"}]
        return []
