from __future__ import annotations

import ast

from implementation.ast.protocols import PythonAstNodeIndexContract
from implementation.references.protocols import (
    PythonContainerKeysContract,
    PythonSubtestAliasAnalysisContract,
    PythonSubtestAliasesOptionsContract,
)
from implementation.references.test_assertions.python_subtest_alias_analysis import PythonSubtestAliasAnalysis
from implementation.references.test_assertions.types import (
    PythonSubtestAssignmentIndex,
    PythonSubtestAssignmentList,
)


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

    def _scope_assignments(self, scope: ast.AST) -> PythonSubtestAssignmentList:
        """Responsibilities: _scope assignment index_."""
        cached = self._assignment_index.get(scope)
        if cached is not None:
            return cached
        assignments: PythonSubtestAssignmentList = []
        for item in ast.walk(scope):
            match item:
                case ast.Assign() | ast.AnnAssign():
                    if self._scope(item) is scope:
                        assignments.append(item)
        result = sorted(assignments, key=lambda item: (item.lineno, item.col_offset))
        self._assignment_index.update({scope: result})
        return result

    def __init__(self, options: PythonSubtestAliasesOptionsContract) -> None:
        """Responsibilities: _initialization subtest aliases_."""
        self._tree: ast.AST = options.tree
        self._node_index: PythonAstNodeIndexContract = options.node_index
        self._container_keys: PythonContainerKeysContract = options.container_keys
        self._options: PythonSubtestAliasesOptionsContract = options
        self._assignment_index: PythonSubtestAssignmentIndex = {}
        self._analysis_cache: dict[ast.AST, PythonSubtestAliasAnalysisContract] = {}

    def aliases_for(self, node: ast.AST) -> set[str]:
        """Responsibilities: _scope subtest alias lookup_."""
        match node:
            case (ast.With() | ast.AsyncWith()) as located_node:
                pass
            case _:
                return set()
        analysis = self._analysis_cache.get(located_node)
        if analysis is None:
            scope = self._scope(located_node)
            analysis = PythonSubtestAliasAnalysis(
                located_node,
                scope,
                self._scope_assignments(scope),
                self._options,
            )
            self._analysis_cache.update({located_node: analysis})
        return analysis.aliases

    def matches(self, node: ast.AST, aliases: set[str]) -> bool:
        """Responsibilities: _subtest context classification_."""
        match node:
            case (ast.With() | ast.AsyncWith()) as located_node:
                pass
            case _:
                return False
        scope = self._scope(located_node)
        analysis = self._analysis_cache.get(located_node)
        if analysis is None:
            analysis = PythonSubtestAliasAnalysis(
                located_node,
                scope,
                self._scope_assignments(scope),
                self._options,
            )
            self._analysis_cache.update({located_node: analysis})
        return analysis.matches(aliases)
