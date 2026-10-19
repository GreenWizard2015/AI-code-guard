from __future__ import annotations

import ast
from collections.abc import Iterable
from functools import cached_property
from typing import Any

from implementation.protocols import PythonCallableArgumentsContract
from implementation.references.aliases.protocols import PythonReferenceAliasesContract
from implementation.references.aliases.python_reference_aliases import (
    PythonReferenceAliases,
)
from implementation.types import JsonObject
from implementation.rules.constants import (
    PYTHON_TYPE_ALIAS_FACTORY_NAME,
    PYTHON_TYPE_ALIAS_NAME,
    PYTHON_TYPING_EXTENSIONS_MODULE,
    PYTHON_TYPING_MODULE,
)


class PythonTypeDeclarationCollector:
    """Responsibilities: _type declaration extraction_, _annotation alias resolution_."""

    def _named_factory_name(self, name: str) -> str:
        """Responsibilities: _aliased TypeAliasType factory resolution_."""
        if self.aliases.resolved_name(
            name, frozenset({PYTHON_TYPE_ALIAS_FACTORY_NAME})
        ):
            return PYTHON_TYPE_ALIAS_FACTORY_NAME
        return ""

    def _attribute_factory_name(self, function: ast.Attribute) -> str:
        """Responsibilities: _qualified TypeAliasType factory resolution_."""
        if function.attr != PYTHON_TYPE_ALIAS_FACTORY_NAME:
            return ""
        if type(function.value) is not ast.Name:
            return ""
        if function.value.id not in {
            PYTHON_TYPING_MODULE,
            PYTHON_TYPING_EXTENSIONS_MODULE,
        }:
            return ""
        return PYTHON_TYPE_ALIAS_FACTORY_NAME

    def _factory_name(self, function: ast.AST) -> str:
        """Responsibilities: _TypeAliasType factory name resolution_."""
        if type(function) is ast.Name:
            return self._named_factory_name(function.id)
        if type(function) is not ast.Attribute:
            return ""
        return self._attribute_factory_name(function)

    def _type_alias_factory(self, value: ast.AST) -> bool:
        """Responsibilities: _classification TypeAliasType factory_."""
        if type(value) is not ast.Call:
            return False
        return self._factory_name(value.func) != ""

    def _factory_in_value(self, value: ast.AST) -> bool:
        """Responsibilities: _classification nested TypeAliasType factory_."""
        for node in ast.walk(value):
            if type(node) is ast.Call:
                if self._type_alias_factory(node):
                    return True
        return False

    def _annotated_declaration(self, node: ast.AnnAssign) -> list[JsonObject]:
        """Responsibilities: _collection annotated type declaration_."""
        if type(node.target) is not ast.Name:
            return []
        is_alias_annotation = self.type_alias_annotation(node.annotation)
        is_factory = False
        if node.value is not None:
            is_factory = self._factory_in_value(node.value)
        if not is_alias_annotation and not is_factory:
            return []
        return [{"name": node.target.id, "line": node.lineno - 1}]

    def _assigned_declaration(self, node: ast.Assign) -> list[JsonObject]:
        """Responsibilities: _collection assigned type declaration_."""
        if len(node.targets) == 0:
            return []
        target: Any = node.targets[0]
        is_factory = self._factory_in_value(node.value)
        is_structural = self.callable_arguments.structural_type(node.value)
        if not is_factory:
            if len(node.targets) != 1:
                return []
            if type(target) is not ast.Name:
                return []
            if not is_structural:
                return []
        return [{"name": ast.unparse(target), "line": node.lineno - 1}]

    def __init__(
        self, tree: ast.Module, callable_arguments: PythonCallableArgumentsContract
    ) -> None:
        """Responsibilities: _initialization type declaration collector_."""
        self.tree: ast.Module = tree
        self.callable_arguments: PythonCallableArgumentsContract = callable_arguments

    @cached_property
    def aliases(self) -> PythonReferenceAliasesContract:
        """Responsibilities: _collection type declaration aliases_."""
        aliases = PythonReferenceAliases()
        aliases.collect(self.tree)
        return aliases

    def type_alias_annotation(self, annotation: ast.AST) -> bool:
        """Responsibilities: _classification type alias annotation_."""
        if type(annotation) is ast.Name:
            return bool(
                self.aliases.resolved_name(
                    annotation.id, frozenset({PYTHON_TYPE_ALIAS_NAME})
                )
            )
        if (
            type(annotation) is not ast.Attribute
            or annotation.attr != PYTHON_TYPE_ALIAS_NAME
        ):
            return False
        if type(annotation.value) is not ast.Name:
            return False
        return annotation.value.id in {
            PYTHON_TYPING_MODULE,
            PYTHON_TYPING_EXTENSIONS_MODULE,
        }

    def declaration(self, node: ast.AST) -> list[JsonObject]:
        """Responsibilities: _classification type declaration_."""
        if type(node) is ast.ClassDef:
            return [{"name": node.name, "line": node.lineno - 1}]
        if type(node) is ast.AnnAssign:
            return self._annotated_declaration(node)
        if type(node) is ast.Assign:
            return self._assigned_declaration(node)
        return []

    def declarations(self, nodes: Iterable[ast.AST]) -> list[JsonObject]:
        """Responsibilities: _collection type declarations_."""
        declarations: list[JsonObject] = []
        for node in nodes:
            declarations.extend(self.declaration(node))
        return declarations
