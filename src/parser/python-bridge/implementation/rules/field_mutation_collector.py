from __future__ import annotations


from typing import Any
import ast
from implementation.ast.protocols import PythonAstNodeIndexProtocol
from implementation.references.aliases.container_aliases import PythonContainerAliases
from implementation.references.aliases.protocols import PythonContainerAliasesProtocol
from implementation.references.aliases.container_keys import PythonContainerKeys
from implementation.references.aliases.reference_aliases import PythonReferenceAliases
from implementation.types import JsonObject


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
            for item in ast.walk(method):
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
        if value.attr != "__dict__":
            return False
        if type(value.value) is not ast.Name:
            return False
        if value.value.id not in aliases:
            return False
        return bool(self.container_keys.static_key(target.slice))

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
        return bool(self.container_keys.static_key(target.slice))

    def __init__(
        self,
        tree: ast.AST,
        node_index: PythonAstNodeIndexProtocol,
    ) -> None:
        """Responsibilities: _AST parent indexes initialization_."""
        self.tree: Any = tree
        self.node_index: Any = node_index
        self.container_aliases: PythonContainerAliasesProtocol = (
            PythonContainerAliases()
        )
        self.container_keys: PythonContainerKeys = self.container_aliases.values.keys
        self.parents: dict[int, ast.AST] = {}
        self.assignment_aliases: PythonReferenceAliases = PythonReferenceAliases()

    def prepare(self) -> None:
        """Responsibilities: _field mutation traversal preparation_."""
        self.container_aliases.observe_all(self.node_index.nodes(self.tree))
        self.parents.clear()
        for node in self.node_index.nodes(self.tree):
            for child in ast.iter_child_nodes(node):
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
            if method.name in {"__init__", "__post_init__"}:
                return []
            aliases = self._method_self_aliases(method)
            if any(
                self.field_target(target, aliases)
                for target in self._assignment_targets(node)
            ):
                return [{"line": node.lineno - 1, "kind": "mutable-field-assignment"}]
        return []
