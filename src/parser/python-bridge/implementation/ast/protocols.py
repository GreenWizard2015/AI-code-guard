from __future__ import annotations

from typing import Protocol, TextIO
import ast
from implementation.types import JsonObject


class PythonAstNodeIndexProtocol(Protocol):
    """Responsibilities: _define AST node parent_."""

    def nodes(self, root: ast.AST) -> list[ast.AST]: ...

    def parents(self, node: ast.AST) -> list[ast.AST]: ...


class PythonAstContentTreeProtocol(Protocol):
    """Responsibilities: _AST content collection boundary_."""

    def timings_data(self) -> dict[str, float]: ...


class PythonCallableStatementsProtocol(Protocol):
    """Responsibilities: _callable statement operations contract_."""

    def body_without_docstring(self, body: list[ast.stmt]) -> list[ast.stmt]: ...

    def statement_node(self, node: ast.stmt) -> JsonObject: ...


class PythonCallableArgumentsProtocol(Protocol):
    """Responsibilities: _callable argument operations contract_."""

    def callable_arguments(self, node: ast.AST) -> list[ast.arg]: ...

    def argument_metadata(
        self, node: ast.AST, arguments: list[ast.arg], characters: int
    ) -> JsonObject: ...


class PythonCallableMetricsProtocol(Protocol):
    """Responsibilities: _callable metric operations contract_."""

    def statements_sloc(self, items: list[ast.stmt]) -> int: ...


class PythonSourceSegmentsProtocol(Protocol):
    """Responsibilities: _source segment operations contract_."""

    def segment(self, node: ast.AST) -> str: ...

    def significant_characters(self, text: str) -> int: ...


class PythonAstTimedResultProtocol(Protocol):
    """Responsibilities: _AST timing values_."""

    def ast_data(self) -> JsonObject: ...

    def syntax_duration(self) -> float: ...

    def normalization_duration(self) -> float: ...

    def stage_times(self) -> dict[str, float]: ...


class PythonAstBridgeProtocol(Protocol):
    """Responsibilities: _Python bridge operations_."""

    def source_ast(self, text: str) -> JsonObject: ...

    def source_ast_timed(self, text: str) -> PythonAstTimedResultProtocol: ...

    def stream_ast(self, stream: TextIO) -> JsonObject: ...


class PythonPropertyTypeProtocol(Protocol):
    """Responsibilities: _Python property type resolution_."""

    def annotation_type(self, annotation: ast.AST) -> str: ...

    def init_arguments(self, node: ast.AST) -> dict[str, str]: ...

    def assignment_type(self, node: ast.AST, arguments: dict[str, str]) -> str: ...

    def assignment_target(self, node: ast.AST) -> ast.AST: ...

    def instance_target(self, target: ast.AST) -> bool: ...
