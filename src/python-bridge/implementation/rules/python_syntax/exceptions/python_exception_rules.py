from __future__ import annotations

import ast

from implementation.protocols import (
    PythonExceptionBroadnessContract,
    PythonExceptionMultiplicityContract,
)
from implementation.references.protocols import (
    PythonContainerValuesContract,
    PythonExceptionAliasStateContract,
)
from implementation.rules.protocols import PythonExceptionRulesContract
from implementation.rules.python_syntax.exceptions.python_exception_handler_analysis import (
    PythonExceptionHandlerAnalysis,
    PythonExceptionHandlerAnalysisOptions,
)
from implementation.types import JsonObject


class PythonExceptionRules(PythonExceptionRulesContract):
    """Responsibilities: _exception traversal_, _handler analysis coordination_."""

    _aliases: PythonExceptionAliasStateContract
    _broadness: PythonExceptionBroadnessContract
    _multiplicity: PythonExceptionMultiplicityContract
    _container_values: PythonContainerValuesContract

    def __init__(
        self,
        aliases: PythonExceptionAliasStateContract,
        broadness: PythonExceptionBroadnessContract,
        multiplicity: PythonExceptionMultiplicityContract,
        container_values: PythonContainerValuesContract,
    ) -> None:
        """Responsibilities: _exception rule dependency ownership_."""
        self._aliases = aliases
        self._broadness = broadness
        self._multiplicity = multiplicity
        self._container_values = container_values

    def except_clause_issues(
        self,
        handler: ast.ExceptHandler,
        enclosing_statement: ast.AST,
    ) -> list[JsonObject]:
        """Responsibilities: _single exception handler diagnostics_."""
        analysis = PythonExceptionHandlerAnalysis(
            PythonExceptionHandlerAnalysisOptions(
                handler,
                enclosing_statement,
                self._aliases,
                self._broadness,
                self._multiplicity,
                self._container_values,
            ),
        )
        issues = analysis.issues()
        issues.extend(analysis.context_issues())
        return issues

    def try_statement_issues(self, node: ast.AST) -> list[JsonObject]:
        """Responsibilities: _try statement exception diagnostics_."""
        self._aliases.select(node)
        self._aliases.observe(node)
        match node:
            case ast.Try(handlers=handlers) | ast.TryStar(handlers=handlers):
                pass
            case _:
                return []
        issues: list[JsonObject] = []
        for handler in handlers:
            issues.extend(self.except_clause_issues(handler, node))
        return issues
