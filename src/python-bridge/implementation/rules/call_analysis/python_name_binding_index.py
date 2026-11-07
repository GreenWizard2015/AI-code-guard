from __future__ import annotations

import ast

from implementation.ast.protocols import PythonAstNodeIndexContract
from implementation.rules.constants import (
    PYTHON_MODULE_NAME_ABSENT,
    PYTHON_MODULE_NAME_BOUND,
    PYTHON_MODULE_NAME_REASSIGNED,
    PYTHON_NAME_BINDING_CALLABLE_SCOPE,
    PYTHON_NAME_BINDING_CLASS_SCOPE,
    PYTHON_NAME_BINDING_MODULE_SCOPE,
)
from implementation.rules.protocols import PythonNameBindingIndexContract
from implementation.types import (
    PythonBindingScopesByNode,
    PythonCallableOwners,
    PythonNameSetsByCallable,
)


class PythonNameBindingIndex(PythonNameBindingIndexContract):
    """Responsibilities: _module binding state_, _callable name ownership_."""

    _tree: ast.AST
    _node_index: PythonAstNodeIndexContract
    _module_bound_names: set[str]
    _module_reassigned_names: set[str]
    _function_bound_names: PythonNameSetsByCallable

    def _import_alias_name(self, alias: ast.alias) -> str:
        """Responsibilities: _import local name lookup_."""
        if alias.asname is not None:
            return alias.asname
        if "." in alias.name:
            separator = alias.name.find(".")
            return alias.name[:separator]
        return alias.name

    def _import_names(self, statement: ast.AST) -> list[str]:
        """Responsibilities: _import declaration names_."""
        match statement:
            case ast.Import(names=aliases) | ast.ImportFrom(names=aliases):
                return [self._import_alias_name(alias) for alias in aliases]
            case _:
                return []

    def _append_module_bound_name(self, name: str) -> None:
        """Responsibilities: _module binding insertion_."""
        self._module_bound_names.add(name)

    def _append_module_reassigned_name(self, name: str) -> None:
        """Responsibilities: _module reassignment insertion_."""
        self._module_reassigned_names.add(name)

    def _append_callable_name(self, owner: ast.AST, name: str) -> None:
        """Responsibilities: _callable name insertion_."""
        self._function_bound_names.setdefault(owner, set()).add(name)

    def _append_function_declaration(
        self,
        definition_name: str,
        parent_node: ast.AST,
        owner: ast.AST,
        scope: str,
    ) -> None:
        """Responsibilities: _function declaration scope indexing_."""
        if owner is not self._tree:
            self._append_callable_name(owner, definition_name)
            return
        if parent_node is self._tree and scope == PYTHON_NAME_BINDING_MODULE_SCOPE:
            self._append_module_bound_name(definition_name)

    def _append_stored_name(
        self,
        stored_name: str,
        owner: ast.AST,
        scope: str,
    ) -> None:
        """Responsibilities: _assignment scope indexing_."""
        if owner is self._tree:
            if scope == PYTHON_NAME_BINDING_MODULE_SCOPE:
                self._append_module_reassigned_name(stored_name)
            return
        self._append_callable_name(owner, stored_name)

    def _append_named_declaration(self, name: str, owner: ast.AST, scope: str) -> None:
        """Responsibilities: _declaration scope indexing_."""
        if owner is not self._tree:
            self._append_callable_name(owner, name)
            return
        if scope == PYTHON_NAME_BINDING_MODULE_SCOPE:
            self._append_module_bound_name(name)

    def _append_imports(
        self,
        node: ast.AST,
        owner: ast.AST,
        scope: str,
    ) -> None:
        """Responsibilities: _scoped import indexing_."""
        if type(node) not in (ast.Import, ast.ImportFrom):
            return
        for name in self._import_names(node):
            if owner is self._tree:
                if scope == PYTHON_NAME_BINDING_MODULE_SCOPE:
                    self._append_module_bound_name(name)
                continue
            self._append_callable_name(owner, name)

    def _append_declarations(
        self,
        node: ast.AST,
        parent_node: ast.AST,
        owner: ast.AST,
        scope: str,
    ) -> None:
        """Responsibilities: _scoped declaration indexing_."""
        match node:
            case ast.FunctionDef(name=definition_name) | ast.AsyncFunctionDef(name=definition_name):
                self._append_function_declaration(definition_name, parent_node, owner, scope)
            case ast.Name(id=stored_name, ctx=ast.Store()):
                self._append_stored_name(stored_name, owner, scope)
            case ast.arg(arg=argument_name) | ast.ClassDef(name=argument_name):
                self._append_named_declaration(argument_name, owner, scope)
            case _:
                return

    def _index_name(
        self,
        node: ast.AST,
        parent_node: ast.AST,
        owner: ast.AST,
        scope: str,
    ) -> None:
        """Responsibilities: _single-node name indexing_."""
        self._append_imports(node, owner, scope)
        self._append_declarations(node, parent_node, owner, scope)

    def __init__(self, tree: ast.AST, node_index: PythonAstNodeIndexContract) -> None:
        """Responsibilities: _binding dependency setup_."""
        self._tree = tree
        self._node_index = node_index
        self._module_bound_names = set()
        self._module_reassigned_names = set()
        self._function_bound_names = {}

    def index_tree(self) -> None:
        """Responsibilities: _AST binding index construction_."""
        callable_owners: PythonCallableOwners = {self._tree: self._tree}
        binding_scopes: PythonBindingScopesByNode = {
            self._tree: PYTHON_NAME_BINDING_MODULE_SCOPE,
        }
        for node in self._node_index.nodes(self._tree):
            if node is self._tree:
                continue
            parents = self._node_index.parents(node)
            if parents:
                parent_node = parents[0]
            else:
                parent_node = self._tree
            owner = callable_owners.get(parent_node, self._tree)
            scope = binding_scopes.get(parent_node, PYTHON_NAME_BINDING_CLASS_SCOPE)
            self._index_name(node, parent_node, owner, scope)
            if type(node) in (ast.FunctionDef, ast.AsyncFunctionDef, ast.Lambda):
                callable_owners[node] = node
                binding_scopes[node] = PYTHON_NAME_BINDING_CALLABLE_SCOPE
                continue
            if type(node) is ast.ClassDef:
                callable_owners[node] = owner
                binding_scopes[node] = PYTHON_NAME_BINDING_CLASS_SCOPE
                continue
            callable_owners[node] = owner
            binding_scopes[node] = scope

    def module_binding(self, name: str) -> str:
        """Responsibilities: _module binding lookup_."""
        if type(self._tree) is not ast.Module:
            return PYTHON_MODULE_NAME_ABSENT
        if name in self._module_reassigned_names:
            return PYTHON_MODULE_NAME_REASSIGNED
        if name in self._module_bound_names:
            return PYTHON_MODULE_NAME_BOUND
        return PYTHON_MODULE_NAME_ABSENT

    def function_binds(self, function: ast.AST, name: str) -> bool:
        """Responsibilities: _callable binding lookup_."""
        return name in self._function_bound_names.get(function, set())
