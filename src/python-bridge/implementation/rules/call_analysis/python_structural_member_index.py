from __future__ import annotations

import ast

from implementation.ast.protocols import PythonAstNodeIndexContract
from implementation.rules.constants import (
    PYTHON_PROTOCOL_NAME,
    PYTHON_TYPING_EXTENSIONS_MODULE,
    PYTHON_TYPING_MODULE,
)
from implementation.types import (
    PythonNameSetIndex,
    PythonStructuralImplementationsIndex,
)


class PythonStructuralMemberIndex:
    """Responsibilities: _Protocol member index_, _implementation contract index_."""

    _protocol_members: PythonNameSetIndex
    _implementations: PythonStructuralImplementationsIndex
    _protocol_names: set[str]
    _protocol_modules: set[str]
    _tree: ast.AST
    _node_index: PythonAstNodeIndexContract

    def _append_from_import(self, statement: ast.ImportFrom) -> None:
        """Responsibilities: _Protocol name import bindings_."""
        if statement.module not in (
            PYTHON_TYPING_MODULE,
            PYTHON_TYPING_EXTENSIONS_MODULE,
        ):
            return
        for alias in statement.names:
            if alias.name != PYTHON_PROTOCOL_NAME:
                continue
            self._protocol_names.add(alias.asname or alias.name)

    def _append_module_import(self, statement: ast.Import) -> None:
        """Responsibilities: _typing module import bindings_."""
        for alias in statement.names:
            if alias.name not in (
                PYTHON_TYPING_MODULE,
                PYTHON_TYPING_EXTENSIONS_MODULE,
            ):
                continue
            self._protocol_modules.add(alias.asname or alias.name)

    def _append_typing_imports(self) -> None:
        """Responsibilities: _typing Protocol import bindings_."""
        if type(self._tree) is not ast.Module:
            return
        for statement in self._tree.body:
            if type(statement) is ast.ImportFrom:
                self._append_from_import(statement)
            if type(statement) is ast.Import:
                self._append_module_import(statement)

    def _protocol_base(self, base: ast.AST) -> bool:
        """Responsibilities: _typing Protocol inheritance classification_."""
        if type(base) is ast.Name:
            return base.id in self._protocol_names
        if type(base) is not ast.Attribute:
            return False
        if type(base.value) is ast.Name:
            module_is_protocol = base.value.id in self._protocol_modules
            if module_is_protocol:
                return base.attr == PYTHON_PROTOCOL_NAME
        return False

    def _callable_member_names(self, members: list[ast.stmt]) -> set[str]:
        """Responsibilities: _protocol callable member names_."""
        names: set[str] = set()
        for member in members:
            if type(member) is ast.FunctionDef:
                names.add(member.name)
            if type(member) is ast.AsyncFunctionDef:
                names.add(member.name)
        return names

    def _append_protocols(self) -> None:
        """Responsibilities: _project Protocol member collection_."""
        for node in self._node_index.nodes(self._tree):
            if type(node) is not ast.ClassDef:
                continue
            if not any(self._protocol_base(base) for base in node.bases):
                continue
            self._protocol_members.update({node.name: self._callable_member_names(node.body)})

    def _append_implementations(self) -> None:
        """Responsibilities: _concrete Protocol implementation indexing_."""
        for node in self._node_index.nodes(self._tree):
            if type(node) is not ast.ClassDef:
                continue
            members = self._callable_member_names(node.body)
            for base in node.bases:
                if type(base) is not ast.Name:
                    continue
                contract = self._protocol_members.get(base.id)
                if contract is None:
                    continue
                if not contract.issubset(members):
                    continue
                implementations = self._implementations.setdefault(node.name, {})
                implementations[base.id] = contract

    def __init__(self, tree: ast.AST, node_index: PythonAstNodeIndexContract) -> None:
        """Responsibilities: _source-bound Protocol index construction_."""
        self._tree = tree
        self._node_index = node_index
        self._protocol_members = {}
        self._implementations = {}
        self._protocol_names = set()
        self._protocol_modules = set()

    def prepare(self) -> None:
        """Responsibilities: _source Protocol contract indexing_."""
        tree = self._tree
        if type(tree) is not ast.Module:
            return
        self._append_typing_imports()
        self._append_protocols()
        self._append_implementations()

    def members(self, name: str) -> set[str]:
        """Responsibilities: _Protocol method lookup_."""
        return self._protocol_members.get(name, set())

    def contains(self, name: str) -> bool:
        """Responsibilities: _Protocol identity lookup_."""
        return name in self._protocol_members

    def implementation_contracts(self, class_name: str) -> PythonNameSetIndex:
        """Responsibilities: _implementation Protocol lookup_."""
        return self._implementations.get(class_name, {})
