from __future__ import annotations

import ast
from typing import Protocol

from implementation.types import JsonObject


class PythonCodingIssueFlowStateContract(Protocol):
    """Responsibilities: _flow state access_."""

    def control_flow(self) -> PythonControlFlowIssuesContract: ...

    def precedence(self) -> PythonOperatorPrecedenceContract: ...


class PythonExpressionBoundaryContract(Protocol):
    """Responsibilities: _expression boundary contract_."""

    def negation_comparison_boundary(self, node: ast.AST) -> bool: ...

    def parenthesized(self, node: ast.AST) -> bool: ...

    def ungrouped(self, node: ast.AST, root_parenthesized: bool = False) -> bool: ...


class PythonTerminalBranchContract(Protocol):
    """Responsibilities: _terminal branch contract_."""

    def terminal_block(self, statements: list[ast.stmt]) -> bool: ...


class PythonLogicalChainAnalysisContract(Protocol):
    """Responsibilities: _logical chain findings_, _parent expression lookup_."""

    def parent(self, expression: ast.AST) -> ast.AST: ...

    def issues(self) -> list[JsonObject]: ...


class PythonAssignmentEffectsContract(Protocol):
    """Responsibilities: _assignment syntax state_."""

    def assigned_value(self) -> ast.AST: ...

    def declared_annotation(self) -> ast.expr: ...

    def annotation_present(self) -> bool: ...

    def runtime_value_present(self) -> bool: ...


class PythonExceptionRulesContract(Protocol):
    """Responsibilities: _exception rule collection_."""

    def try_statement_issues(self, node: ast.AST) -> list[JsonObject]: ...

    def timings_data(self) -> dict[str, float]: ...


class PythonExceptionHandlerAssignmentsContract(Protocol):
    """Responsibilities: _handler assignment state_, _exception cause lookup_."""

    def record_statement(self, statement: ast.stmt) -> None: ...

    def explicit_none_cause(self, cause: ast.AST) -> bool: ...


class PythonControlFlowIssuesContract(Protocol):
    """Responsibilities: _control-flow issue collection_."""

    def conditional_issues(self, node: ast.AST) -> list[JsonObject]: ...

    def elif_issues(self, node: ast.AST) -> list[JsonObject]: ...

    def walrus_issues(self, node: ast.AST) -> list[JsonObject]: ...


class PythonOperatorPrecedenceContract(Protocol):
    """Responsibilities: _operator precedence analysis_."""

    def mixed_boolean_operator(self, node: ast.AST) -> list[JsonObject]: ...

    def mixed_arithmetic_operator(self, node: ast.AST) -> list[JsonObject]: ...
