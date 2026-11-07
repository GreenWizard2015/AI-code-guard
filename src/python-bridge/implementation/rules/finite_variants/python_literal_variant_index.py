from __future__ import annotations

import ast

from implementation.rules.constants import (
    PYTHON_LITERAL_NAME,
    PYTHON_TYPING_EXTENSIONS_MODULE,
    PYTHON_TYPING_MODULE,
)
from implementation.types import PythonNameSetIndex


class PythonLiteralVariantIndex:
    """Responsibilities: _Literal import resolution_, _Literal alias indexing_."""

    _members: PythonNameSetIndex
    _discriminants: dict[str, str]
    _literal_names: set[str]
    _literal_modules: set[str]

    def _import_name(self, imported: ast.alias) -> str:
        """Responsibilities: _import alias resolution_."""
        if imported.asname:
            return imported.asname
        return imported.name

    def _append_import_from(self, statement: ast.ImportFrom) -> None:
        """Responsibilities: _Literal symbol import registration_."""
        if statement.module not in (
            PYTHON_TYPING_MODULE,
            PYTHON_TYPING_EXTENSIONS_MODULE,
        ):
            return
        for imported in statement.names:
            if imported.name == PYTHON_LITERAL_NAME:
                self._literal_names.add(self._import_name(imported))

    def _append_module_import(self, statement: ast.Import) -> None:
        """Responsibilities: _typing module import registration_."""
        for imported in statement.names:
            if imported.name not in (
                PYTHON_TYPING_MODULE,
                PYTHON_TYPING_EXTENSIONS_MODULE,
            ):
                continue
            self._literal_modules.add(self._import_name(imported))

    def _is_literal(self, annotation: ast.AST) -> bool:
        """Responsibilities: _Literal expression recognition_."""
        if type(annotation) is ast.Name:
            return annotation.id in self._literal_names
        if type(annotation) is ast.Attribute and type(annotation.value) is ast.Name:
            if annotation.value.id not in self._literal_modules:
                return False
            return annotation.attr == PYTHON_LITERAL_NAME
        return False

    def _literal_elements(self, value: ast.AST) -> list[ast.expr]:
        """Responsibilities: _Literal argument extraction_."""
        if type(value) is not ast.Subscript:
            return []
        if not self._is_literal(value.value):
            return []
        if type(value.slice) is ast.Tuple:
            return value.slice.elts
        return [value.slice]

    def _string_members(self, elements: list[ast.expr]) -> set[str]:
        """Responsibilities: _string Literal member extraction_."""
        if not elements:
            return set()
        members: set[str] = set()
        for element in elements:
            if type(element) is not ast.Constant or type(element.value) is not str:
                return set()
            members.add(element.value)
        return members

    def _append_literal_members(self, name: str, alias_expression: ast.AST) -> None:
        """Responsibilities: _Literal member indexing_."""
        elements = self._literal_elements(alias_expression)
        members = self._string_members(elements)
        if members:
            self._members.update({name: members})

    def _append_assigned_alias(self, statement: ast.Assign) -> None:
        """Responsibilities: _assigned Literal alias indexing_."""
        if len(statement.targets) != 1:
            return
        target = statement.targets[0]
        if type(target) is ast.Name:
            self._append_literal_members(target.id, statement.value)

    def _append_annotated_alias(self, statement: ast.AnnAssign) -> None:
        """Responsibilities: _annotated Literal alias indexing_."""
        if statement.value is None or type(statement.target) is not ast.Name:
            return
        self._append_literal_members(statement.target.id, statement.value)

    def __init__(
        self,
        members: PythonNameSetIndex,
        discriminants: dict[str, str],
    ) -> None:
        """Responsibilities: _Literal index initialization_."""
        self._members = members
        self._discriminants = discriminants
        self._literal_names = set()
        self._literal_modules = set()

    def prepare_imports(self, tree: ast.Module) -> None:
        """Responsibilities: _Literal import indexing_."""
        self._literal_names.clear()
        self._literal_modules.clear()
        for statement in tree.body:
            if type(statement) is ast.ImportFrom:
                self._append_import_from(statement)
            if type(statement) is ast.Import:
                self._append_module_import(statement)

    def append_alias(self, alias_declaration: ast.AST) -> None:
        """Responsibilities: _Literal declaration indexing_."""
        if type(alias_declaration) is ast.Assign:
            self._append_assigned_alias(alias_declaration)
        if type(alias_declaration) is ast.AnnAssign:
            self._append_annotated_alias(alias_declaration)
