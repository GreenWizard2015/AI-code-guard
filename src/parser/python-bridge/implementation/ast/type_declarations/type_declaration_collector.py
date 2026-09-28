from __future__ import annotations

import ast
from collections.abc import Iterable
from functools import cached_property
from typing import Any
from implementation.ast.protocols import PythonCallableArgumentsProtocol
from implementation.references.aliases.protocols import PythonReferenceAliasesProtocol
from implementation.references.aliases.reference_aliases import PythonReferenceAliases
from implementation.types import JsonObject


class PythonTypeDeclarationCollector:
    """Responsibilities: _collection Python type declarations_."""

    def _type_alias_factory(self, value: ast.AST) -> bool:
        """Responsibilities: _classification TypeAliasType factory_."""
        if type(value) is not ast.Call:
            return False
        function = value.func
        if type(function) is ast.Name:
            return bool(self.aliases.resolved_name(function.id, frozenset({"TypeAliasType"})))
        if type(function) is not ast.Attribute or function.attr != "TypeAliasType":
            return False
        if type(function.value) is not ast.Name:
            return False
        return function.value.id in {"typing", "typing_extensions"}

    def _factory_in_value(self, value: ast.AST) -> bool:
        """Responsibilities: _classification nested TypeAliasType factory_."""
        for node in ast.walk(value):
            if type(node) is ast.Call and self._type_alias_factory(node):
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

    def __init__(self, tree: ast.Module, callable_arguments: PythonCallableArgumentsProtocol) -> None:
        """Responsibilities: _initialization type declaration collector_."""
        self.tree: ast.Module = tree
        self.callable_arguments: PythonCallableArgumentsProtocol = callable_arguments

    @cached_property
    def aliases(self) -> PythonReferenceAliasesProtocol:
        """Responsibilities: _collection type declaration aliases_."""
        aliases = PythonReferenceAliases()
        aliases.collect(self.tree)
        return aliases

    def type_alias_annotation(self, annotation: ast.AST) -> bool:
        """Responsibilities: _classification type alias annotation_."""
        if type(annotation) is ast.Name:
            return bool(self.aliases.resolved_name(annotation.id, frozenset({"TypeAlias"})))
        if type(annotation) is not ast.Attribute or annotation.attr != "TypeAlias":
            return False
        if type(annotation.value) is not ast.Name:
            return False
        return annotation.value.id in {"typing", "typing_extensions"}

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
