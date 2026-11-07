from __future__ import annotations

import ast

from implementation.ast.protocols import PythonAstNodeIndexContract
from implementation.rules.constants import (
    PYTHON_LITERAL_NAME,
    PYTHON_TYPING_EXTENSIONS_MODULE,
    PYTHON_TYPING_MODULE,
)
from implementation.types import PythonNameSetIndex

PythonTagFieldIndex = dict[str, str]


class PythonDiscriminatedUnionIndex:
    """Responsibilities: _tag field indexing_, _tagged union resolution_."""

    _members: PythonNameSetIndex
    _discriminants: dict[str, str]
    _literal_names: set[str]
    _literal_modules: set[str]
    _tag_fields: dict[str, PythonTagFieldIndex]
    _node_index: PythonAstNodeIndexContract

    def _import_name(self, imported: ast.alias) -> str:
        """Responsibilities: _typing import alias resolution_."""
        if imported.asname:
            return imported.asname
        return imported.name

    def _append_import_from(self, statement: ast.ImportFrom) -> None:
        """Responsibilities: _Literal symbol import indexing_."""
        if statement.module not in (
            PYTHON_TYPING_MODULE,
            PYTHON_TYPING_EXTENSIONS_MODULE,
        ):
            return
        for imported in statement.names:
            if imported.name == PYTHON_LITERAL_NAME:
                self._literal_names.add(self._import_name(imported))

    def _append_module_import(self, statement: ast.Import) -> None:
        """Responsibilities: _typing module alias indexing_."""
        for imported in statement.names:
            if imported.name in (PYTHON_TYPING_MODULE, PYTHON_TYPING_EXTENSIONS_MODULE):
                self._literal_modules.add(self._import_name(imported))

    def _is_literal(self, annotation: ast.AST) -> bool:
        """Responsibilities: _Literal annotation recognition_."""
        if type(annotation) is ast.Name:
            return annotation.id in self._literal_names
        if type(annotation) is ast.Attribute and type(annotation.value) is ast.Name:
            return annotation.value.id in self._literal_modules and annotation.attr == PYTHON_LITERAL_NAME
        return False

    def _tag_value(self, annotation: ast.AST) -> str:
        """Responsibilities: _literal discriminator extraction_."""
        if type(annotation) is not ast.Subscript:

            return ""
        if not self._is_literal(annotation.value):
            return ""
        values = [annotation.slice]
        if type(annotation.slice) is ast.Tuple:
            values = annotation.slice.elts
        if len(values) != 1 or type(values[0]) is not ast.Constant:
            return ""
        if type(values[0].value) is not str:
            return ""
        return values[0].value

    def _append_tag_field(self, class_node: ast.ClassDef) -> None:
        """Responsibilities: _class discriminator indexing_."""
        fields: PythonTagFieldIndex = {}
        for statement in class_node.body:
            if type(statement) is not ast.AnnAssign or type(statement.target) is not ast.Name:
                continue
            value = self._tag_value(statement.annotation)
            if value:
                fields[statement.target.id] = value
        if fields:
            self._tag_fields.update({class_node.name: fields})

    def _union_names(self, union_expression: ast.AST) -> list[str]:
        """Responsibilities: _finite union branch extraction_."""
        if type(union_expression) is ast.Name:
            return [union_expression.id]
        if type(union_expression) is ast.BinOp:
            if type(union_expression.op) is not ast.BitOr:
                return []
            return [
                *self._union_names(union_expression.left),
                *self._union_names(union_expression.right),
            ]
        return []

    def _candidate_names(self, fields: list[PythonTagFieldIndex]) -> set[str]:
        """Responsibilities: _distinct shared discriminator selection_."""
        candidates = set(fields[0])
        for branch_fields in fields[1:]:
            candidates.intersection_update(branch_fields)
        return {
            field_name for field_name in candidates if len({branch[field_name] for branch in fields}) == len(fields)
        }

    def _append_alias_value(self, name: str, alias_value: ast.AST) -> None:
        """Responsibilities: _union branch indexing_."""
        branches = self._union_names(alias_value)
        if len(branches) < 2:
            return
        self._register_union(name, branches)

    def _append_assigned_union(self, statement: ast.Assign) -> None:
        """Responsibilities: _assigned tagged union indexing_."""
        if len(statement.targets) != 1:
            return
        target = statement.targets[0]
        if type(target) is ast.Name:
            self._append_alias_value(target.id, statement.value)

    def _append_annotated_union(self, statement: ast.AnnAssign) -> None:
        """Responsibilities: _annotated tagged union indexing_."""
        if statement.value is None or type(statement.target) is not ast.Name:
            return
        self._append_alias_value(statement.target.id, statement.value)

    def _append_discriminated_union(self, alias_declaration: ast.AST) -> None:
        """Responsibilities: _finite tagged union indexing_."""
        if type(alias_declaration) is ast.Assign:
            self._append_assigned_union(alias_declaration)
        if type(alias_declaration) is ast.AnnAssign:
            self._append_annotated_union(alias_declaration)

    def _register_union(self, name: str, branches: list[str]) -> None:
        """Responsibilities: _tagged union registration_."""
        fields = self._union_fields(branches)
        if len(fields) != len(branches):
            return
        candidates = self._candidate_names(fields)
        if len(candidates) != 1:
            return
        discriminant = next(iter(candidates))
        self._members.update({name: {branch[discriminant] for branch in fields}})
        self._discriminants.update({name: discriminant})

    def _union_fields(self, branches: list[str]) -> list[PythonTagFieldIndex]:
        """Responsibilities: _complete branch tag resolution_."""
        fields: list[PythonTagFieldIndex] = []
        for branch in branches:
            branch_fields = self._tag_fields.get(branch)
            if branch_fields is None:
                return []
            fields.append(branch_fields)
        return fields

    def __init__(
        self,
        members: PythonNameSetIndex,
        discriminants: dict[str, str],
        node_index: PythonAstNodeIndexContract,
    ) -> None:
        """Responsibilities: _tagged union index initialization_."""
        self._members = members
        self._discriminants = discriminants
        self._node_index = node_index
        self._literal_names = set()
        self._literal_modules = set()
        self._tag_fields = {}

    def prepare_imports(self, tree: ast.Module) -> None:
        """Responsibilities: _Literal discriminator import indexing_."""
        self._literal_names.clear()
        self._literal_modules.clear()
        self._tag_fields.clear()
        for statement in tree.body:
            if type(statement) is ast.ImportFrom:
                self._append_import_from(statement)
            if type(statement) is ast.Import:
                self._append_module_import(statement)

    def add_source(self, tree: ast.Module) -> None:
        """Responsibilities: _tagged union source indexing_."""
        nodes = self._node_index.nodes(tree)
        for node in nodes:
            if type(node) is ast.ClassDef:
                self._append_tag_field(node)
        for node in nodes:
            self._append_discriminated_union(node)
