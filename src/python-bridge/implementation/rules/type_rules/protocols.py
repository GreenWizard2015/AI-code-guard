from __future__ import annotations

import ast
from typing import Protocol

from implementation.ast.protocols import PythonAstNodeIndexContract
from implementation.protocols import (
    PythonTupleTypeNamesContract,
    PythonTypeFactoryNamesContract,
)
from implementation.rules.protocols import (
    PythonDecoratorAliasStateContract,
    PythonDecoratorRuleContract,
)
from implementation.types import JsonObject, PythonCallableAstNode


class TypeRulesOptionsContract(Protocol):
    """Responsibilities: _type rule analysis dependencies_."""

    @property
    def tree(self) -> ast.AST: ...

    @property
    def node_index(self) -> PythonAstNodeIndexContract: ...

    @property
    def decorator_rules(self) -> PythonDecoratorRuleContract: ...

    @property
    def decorator_aliases(self) -> PythonDecoratorAliasStateContract: ...

    @property
    def type_factory_names(self) -> PythonTypeFactoryNamesContract: ...

    @property
    def tuple_type_names(self) -> PythonTupleTypeNamesContract: ...


class PythonTypeFactoryIssuesContract(Protocol):
    """Responsibilities: _type factory issue operations_."""

    def issues(self, syntax_node: ast.AST) -> list[JsonObject]: ...


class PythonDeclaredAnnotationIssuesContract(Protocol):
    """Responsibilities: _declared annotation issue operations_."""

    def issues(self, declaration: ast.AST) -> list[JsonObject]: ...

    def generic_issues(
        self,
        declaration: PythonCallableAstNode,
    ) -> list[JsonObject]: ...
