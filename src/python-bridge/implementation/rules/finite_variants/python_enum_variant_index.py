from __future__ import annotations

import ast

from implementation.types import PythonNameSetIndex


class PythonEnumVariantIndex:
    """Responsibilities: _enum base import resolution_, _enum member indexing_."""

    _members: PythonNameSetIndex
    _enum_names: set[str]
    _enum_modules: set[str]

    def _import_name(self, imported: ast.alias) -> str:
        """Responsibilities: _enum import alias resolution_."""
        if imported.asname:
            return imported.asname
        return imported.name

    def _append_import_from(self, statement: ast.ImportFrom) -> None:
        """Responsibilities: _enum symbol registration_."""
        if statement.module != "enum":
            return
        for imported in statement.names:
            if imported.name in {"Enum", "IntEnum", "StrEnum"}:
                self._enum_names.add(self._import_name(imported))

    def _append_import(self, statement: ast.Import) -> None:
        """Responsibilities: _enum module alias registration_."""
        for imported in statement.names:
            if imported.name != "enum":
                continue
            module_alias = imported.asname
            if not module_alias:
                module_name = imported.name
                separator = module_name.find(".")
                module_alias = module_name
                if separator >= 0:
                    module_alias = module_name[:separator]
            self._enum_modules.add(module_alias)

    def _enum_base(self, base: ast.AST) -> bool:
        """Responsibilities: _standard enum base recognition_."""
        if type(base) is ast.Name:
            return base.id in self._enum_names
        if type(base) is ast.Attribute and type(base.value) is ast.Name:
            if base.value.id not in self._enum_modules:
                return False
            return base.attr in {"Enum", "IntEnum", "StrEnum"}
        return False

    def _append_member(
        self,
        target: ast.AST,
        value: ast.AST,
        members: set[str],
        values: set[str],
    ) -> bool:
        """Responsibilities: _enum member uniqueness_."""
        if type(target) is not ast.Name:
            return False
        if target.id.startswith("_"):
            return False
        if type(value) is not ast.Constant:
            return False
        identity = f"{type(value.value).__name__}:{value.value!r}"
        if identity in values:
            return False
        values.add(identity)
        members.add(target.id)
        return True

    def _append_statement(
        self,
        statement: ast.AST,
        members: set[str],
        values: set[str],
    ) -> bool:
        """Responsibilities: _enum assignment processing_."""
        if type(statement) is ast.Assign:
            for target in statement.targets:
                if not self._append_member(target, statement.value, members, values):
                    return False
        if type(statement) is ast.AnnAssign and statement.value is not None:
            if not self._append_member(
                statement.target,
                statement.value,
                members,
                values,
            ):
                return False
        return True

    def _enum_members(self, node: ast.ClassDef) -> set[str]:
        """Responsibilities: _unambiguous enum member collection_."""
        members: set[str] = set()
        values: set[str] = set()
        for statement in node.body:
            if not self._append_statement(statement, members, values):
                return set()
        return members

    def __init__(self, members: PythonNameSetIndex) -> None:
        """Responsibilities: _enum index initialization_."""
        self._members = members
        self._enum_names = set()
        self._enum_modules = set()

    def prepare_imports(self, tree: ast.Module) -> None:
        """Responsibilities: _enum base import indexing_."""
        self._enum_names.clear()
        self._enum_modules.clear()
        for statement in tree.body:
            if type(statement) is ast.ImportFrom:
                self._append_import_from(statement)
            if type(statement) is ast.Import:
                self._append_import(statement)

    def append_declaration(self, node: ast.AST) -> None:
        """Responsibilities: _enum declaration indexing_."""
        if type(node) is not ast.ClassDef:
            return
        if any(self._enum_base(base) for base in node.bases):
            members = self._enum_members(node)
            if members:
                self._members.update({node.name: members})
