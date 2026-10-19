from __future__ import annotations

import ast

from implementation.references.protocols import (
    PythonAnnotationResolverContract,
    PythonCallReturnStateContract,
    PythonLexicalScopeContract,
)


class PythonReferenceNameIndex:
    """Responsibilities: _reference alias index_, _callable owner index_."""

    _aliases: dict[str, str]
    _call_returns: PythonCallReturnStateContract
    _lexical_scope: PythonLexicalScopeContract

    def __init__(
        self,
        aliases: dict[str, str],
        call_returns: PythonCallReturnStateContract,
        lexical_scope: PythonLexicalScopeContract,
    ) -> None:
        """Responsibilities: _name resolution dependencies_."""
        self._aliases: dict[str, str] = aliases
        self._call_returns: PythonCallReturnStateContract = call_returns
        self._lexical_scope: PythonLexicalScopeContract = lexical_scope

    def alias_target(self, name: str) -> str:
        """Responsibilities: _alias chain resolution_."""
        resolved = name
        visited: set[str] = set()
        while resolved in self._aliases:
            if resolved in visited:
                return resolved
            visited.add(resolved)
            next_name = self._aliases[resolved]
            if next_name == resolved:
                return resolved
            resolved = next_name
        return resolved

    def annotation_name(
        self,
        resolver: PythonAnnotationResolverContract,
        annotation: ast.AST,
        generics: frozenset[str],
    ) -> str:
        """Responsibilities: _annotation alias resolution_."""
        resolved = resolver.annotation_name(annotation, self._aliases, generics)
        if not resolved:
            return ""
        return self.alias_target(resolved)

    def callable_key(self, node: ast.AST) -> str:
        """Responsibilities: _callable scope identity_."""
        if type(node) not in (ast.FunctionDef, ast.AsyncFunctionDef):
            return ""
        scopes = self._lexical_scope.scope_chain(node)
        if scopes:
            if scopes[0] == str(id(node)):
                scopes = scopes[1:]
        return f"{scopes[0]}\u0000{node.name}"

    def call_return_owner(
        self, function: ast.AST, node: ast.AST, fallback_to_name: bool
    ) -> str:
        """Responsibilities: _positioned callable output ownership_."""
        if type(function) is not ast.Name:
            return ""
        for scope in self._lexical_scope.scope_chain(node):
            owner = self._call_returns.value(f"{scope}\u0000{function.id}")
            if owner:
                return owner
        owner = self._call_returns.value(function.id)
        if owner or not fallback_to_name:
            return owner
        return self.alias_target(function.id)

    def method_return_owner(self, name: str, owner: str) -> str:
        """Responsibilities: _qualified method output ownership_."""
        qualified_name = name
        if owner:
            qualified_name = f"{owner}.{name}"
        qualified_owner = self._call_returns.value(qualified_name)
        if qualified_owner:
            return qualified_owner
        return self._call_returns.value(name)
