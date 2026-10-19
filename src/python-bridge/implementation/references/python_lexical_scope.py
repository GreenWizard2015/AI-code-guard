from __future__ import annotations

import ast

from implementation.protocols import PythonAstNodeIndexContract
from implementation.references.protocols import PythonLexicalScopeContract


class PythonLexicalScope(PythonLexicalScopeContract):
    """Responsibilities: _lexical ownership scopes_, _source position ordering_."""

    _node_index: PythonAstNodeIndexContract

    def _first_comprehension_iter(self, node: ast.AST, comprehension: ast.AST) -> bool:
        """Responsibilities: _outer-scope comprehension iterable detection_."""
        if type(comprehension) not in (
            ast.ListComp,
            ast.SetComp,
            ast.DictComp,
            ast.GeneratorExp,
        ):
            return False
        generators = comprehension.generators
        if not generators:
            return False
        first_iter = generators[0].iter
        current = node
        while current is not comprehension:
            if current is first_iter:
                return True
            parents = self._node_index.parents(current)
            if not parents:
                return False
            current = parents[0]
        return False

    def __init__(self, node_index: PythonAstNodeIndexContract) -> None:
        """Responsibilities: _AST scope index ownership_."""
        self._node_index: PythonAstNodeIndexContract = node_index

    def scope_chain(self, node: ast.AST) -> list[str]:
        """Responsibilities: _lexical ownership scope traversal_."""
        nested_scopes: list[str] = []
        current = node
        while True:
            if type(current) in (
                ast.FunctionDef,
                ast.AsyncFunctionDef,
                ast.Lambda,
                ast.ClassDef,
            ):
                nested_scopes.append(str(id(current)))
            is_comprehension = type(current) in (
                ast.ListComp,
                ast.SetComp,
                ast.DictComp,
                ast.GeneratorExp,
            )
            if is_comprehension:
                if not self._first_comprehension_iter(node, current):
                    nested_scopes.append(str(id(current)))
            parents = self._node_index.parents(current)
            if not parents:
                break
            current = parents[0]
        return [*nested_scopes, "module"]

    def recording_scope(self, node: ast.AST) -> str:
        """Responsibilities: _binding declaration scope selection_."""
        if type(node) in (ast.FunctionDef, ast.AsyncFunctionDef, ast.Lambda):
            return str(id(node))
        scopes = self.scope_chain(node)
        return scopes[0]
