from __future__ import annotations

import ast
from typing import Protocol

from implementation.types import JsonObject, PythonClassFieldMap


class PythonPropertyTypeContract(Protocol):
    """Responsibilities: _Python property type resolution_."""

    def annotation_type(self, annotation: ast.expr) -> str: ...

    def init_arguments(self, node: ast.AST) -> dict[str, str]: ...

    def assignment_type(self, node: ast.AST, arguments: dict[str, str]) -> str: ...

    def instance_target(self, target: ast.AST) -> bool: ...


class PythonUnionRulesContract(Protocol):
    """Responsibilities: _union rule collection_."""

    def conditional_type_issues(
        self,
        conditional_node: ast.AST,
    ) -> list[JsonObject]: ...

    def annotation_issues(self, declaration_node: ast.AST) -> list[JsonObject]: ...


class PythonUnnecessaryUndefinedCheckContract(Protocol):
    """Responsibilities: _unnecessary undefined checks_."""

    def collect_checks(self, node: ast.AST) -> list[JsonObject]: ...


class PythonSingleItemArrayStateRulesContract(Protocol):
    """Responsibilities: _single-item array rule collection_."""

    def collect_array_rules(self, node: ast.AST) -> list[JsonObject]: ...

    def collect_indexed_result(self, indexed_expression: ast.Subscript) -> list[JsonObject]: ...


class PythonUnboundedTypeRulesContract(Protocol):
    """Responsibilities: _unbounded type diagnostics_."""

    def issues(self) -> list[JsonObject]: ...


class PythonDynamicTypeRulesContract(Protocol):
    """Responsibilities: _dynamic type rule collection_."""

    def configure_imports(self, tree: ast.AST) -> None: ...

    def issues(self, node: ast.AST) -> list[JsonObject]: ...


class PythonArrayTypeInspectorContract(Protocol):
    """Responsibilities: _array type contract_."""

    def array_type(self, annotation: ast.AST) -> bool: ...


class PythonReturnArrayAnalyzerContract(Protocol):
    """Responsibilities: _array result contract_."""

    def single_arrays(self, node: ast.AST) -> bool: ...


class PythonArrayCallAnalyzerContract(Protocol):
    """Responsibilities: _array index category_."""

    def array_call(self, node: ast.Subscript) -> bool: ...


class PythonUndefinedCheckStateContract(Protocol):
    """Responsibilities: _undefined check state contract_."""

    def bindings(self) -> dict[str, ast.expr]: ...

    def fields(self) -> PythonClassFieldMap: ...


class PythonTypingAliasesContract(Protocol):
    """Responsibilities: _typing alias contract_."""

    def expression_name(self, expression: ast.AST) -> str: ...

    def matches_optional(self, name: str) -> bool: ...

    def matches_union(self, name: str) -> bool: ...


class PythonUnionAnnotationRulesContract(Protocol):
    """Responsibilities: _union annotation diagnostics contract_."""

    def requires_analysis(
        self,
        annotation: ast.AST,
        is_field: bool = False,
    ) -> bool: ...

    def issues_for_annotation(
        self,
        annotation: ast.AST,
        is_field: bool = False,
    ) -> list[JsonObject]: ...
