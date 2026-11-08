from __future__ import annotations

import ast
from typing import cast

from implementation.ast.protocols import PythonAstNodeIndexContract
from implementation.references.protocols import (
    PythonContainerKeysContract,
    PythonSubtestAliasAnalysisContract,
    PythonSubtestAliasesOptionsContract,
)
from implementation.references.test_assertions.python_subtest_alias_analysis import (
    PythonSubtestAliasAnalysis,
)
from implementation.types import PythonASTLocatedNode, PythonAstNodeListIndex


class PythonSubtestAliases:
    """Responsibilities: _subtest names_, _scope aliases_."""

    def _scope(self, target: ast.AST) -> ast.AST:
        """Responsibilities: _enclosing function scope_."""
        current = target
        while True:
            parents = self._node_index.parents(current)
            if not parents:
                return self._tree
            parent = parents[0]
            if type(parent) in (ast.FunctionDef, ast.AsyncFunctionDef):
                return parent
            current = parent

    def _scope_assignments(self, scope: ast.AST) -> list[ast.AST]:
        """Responsibilities: _scope assignment index_."""
        cached = self._assignment_index.get(scope)
        if cached is not None:
            return cached
        assignments: list[ast.AST] = []
        for item in ast.walk(scope):
            if type(item) not in (ast.Assign, ast.AnnAssign):
                continue
            if self._scope(item) is scope:
                assignments.append(item)
        located_assignments = cast(list[PythonASTLocatedNode], assignments)
        result = cast(
            list[ast.AST],
            sorted(located_assignments, key=lambda item: (item.lineno, item.col_offset)),
        )
        self._assignment_index.update({scope: result})
        return result

    def __init__(self, options: PythonSubtestAliasesOptionsContract) -> None:
        """Responsibilities: _initialization subtest aliases_."""
        self._tree: ast.AST = options.tree
        self._node_index: PythonAstNodeIndexContract = options.node_index
        self._container_keys: PythonContainerKeysContract = options.container_keys
        self._options: PythonSubtestAliasesOptionsContract = options
        self._assignment_index: PythonAstNodeListIndex = {}
        self._analysis_cache: dict[ast.AST, PythonSubtestAliasAnalysisContract] = {}

    def aliases_for(self, node: ast.AST) -> set[str]:
        """Responsibilities: _scope subtest alias lookup_."""
        if type(node) not in (ast.With, ast.AsyncWith):
            return set()
        analysis = self._analysis_cache.get(node)
        if analysis is None:
            scope = self._scope(node)
            analysis = PythonSubtestAliasAnalysis(
                node,
                scope,
                self._scope_assignments(scope),
                self._options,
            )
            self._analysis_cache.update({node: analysis})
        return analysis.aliases

    def matches(self, node: ast.AST, aliases: set[str]) -> bool:
        """Responsibilities: _subtest context classification_."""
        if type(node) not in (ast.With, ast.AsyncWith):
            return False
        scope = self._scope(node)
        analysis = self._analysis_cache.get(node)
        if analysis is None:
            analysis = PythonSubtestAliasAnalysis(
                node,
                scope,
                self._scope_assignments(scope),
                self._options,
            )
            self._analysis_cache.update({node: analysis})
        return analysis.matches(aliases)
