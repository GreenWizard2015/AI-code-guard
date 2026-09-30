from __future__ import annotations

import ast
from typing import Protocol


class PythonReflectionNamesProtocol(Protocol):
    """Responsibilities: _reflection names contract_."""

    def access_name(self, function: ast.AST) -> str: ...


class PythonArrayTypeInspectorProtocol(Protocol):
    """Responsibilities: _array type contract_."""

    def array_type(self, annotation: ast.AST) -> bool: ...


class PythonReturnArrayAnalyzerProtocol(Protocol):
    """Responsibilities: _array result contract_."""

    def single_arrays(self, node: ast.AST) -> bool: ...


class PythonDecoratorRulesProtocol(Protocol):
    """Responsibilities: _Python decorator rule contract_."""

    def observe(self, node: ast.AST) -> None: ...

    def kinds(self, node: ast.AST) -> set[str]: ...


class PythonPropertyDecoratorProtocol(Protocol):
    """Responsibilities: _property decorator classification contract_."""

    def property_decorator(self, decorator: ast.AST) -> bool: ...


class PythonContainerKeysProtocol(Protocol):
    """Responsibilities: _container key extraction contract_."""

    def static_key(self, value: ast.AST) -> str: ...


class PythonSubtestAliasesProtocol(Protocol):
    """Responsibilities: _subtest alias matching contract_."""

    def matches(self, node: ast.AST) -> bool: ...


class PythonTypingAliasesProtocol(Protocol):
    """Responsibilities: _typing alias contract_."""

    def expression_name(self, value: ast.AST) -> str: ...

    def matches_optional(self, name: str) -> bool: ...

    def matches_union(self, name: str) -> bool: ...


class PythonExceptionAliasStateProtocol(Protocol):
    """Responsibilities: _exception alias state contract_."""

    def broad(self, node: ast.AST) -> bool: ...

    def observe(self, node: ast.AST) -> None: ...

    def exception_names(self) -> set[str]: ...


class PythonSysPathAliasesProtocol(Protocol):
    """Responsibilities: _sys path alias contract_."""

    def system_name(self, name: str) -> bool: ...

    def path_name(self, name: str) -> bool: ...

    def path_mutating(self, name: str) -> bool: ...
