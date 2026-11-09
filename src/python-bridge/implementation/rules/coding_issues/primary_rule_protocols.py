from __future__ import annotations

import ast
from typing import Protocol

from implementation.protocols import (
    PythonTupleTypeNamesContract,
    PythonTypeFactoryNamesContract,
)
from implementation.references.protocols import PythonExceptionAliasStateContract
from implementation.rules.protocols import (
    PythonCallRulesContract,
    PythonConstructorRulesContract,
    PythonDecoratorAliasStateContract,
    PythonDecoratorRuleContract,
    PythonExceptionRulesContract,
)
from implementation.rules.type_rule_protocols import PythonDynamicTypeRulesContract
from implementation.types import CallablePythonRuleStage, JsonObject


class PythonPrimaryRulesContract(Protocol):
    """Responsibilities: _primary Python rules_."""

    def stages(self) -> list[CallablePythonRuleStage]: ...

    def prepare(self, tree: ast.AST) -> None: ...

    def branch_count_issues(self, tree: ast.AST) -> list[JsonObject]: ...

    def rule_set(self) -> PythonPrimaryRuleSetContract: ...

    def timings_data(self) -> dict[str, float]: ...


class PythonPrimaryRuleSetContract(Protocol):
    """Responsibilities: _composed primary rule dependencies_."""

    @property
    def call_rules(self) -> PythonCallRulesContract: ...

    @property
    def decorator_rules(self) -> PythonDecoratorRuleContract: ...

    @property
    def decorator_aliases(self) -> PythonDecoratorAliasStateContract: ...

    @property
    def constructor_rules(self) -> PythonConstructorRulesContract: ...

    @property
    def dynamic_type_rules(self) -> PythonDynamicTypeRulesContract: ...

    @property
    def exception_aliases(self) -> PythonExceptionAliasStateContract: ...

    @property
    def exception_rules(self) -> PythonExceptionRulesContract: ...

    @property
    def type_factory_names(self) -> PythonTypeFactoryNamesContract: ...

    @property
    def tuple_type_names(self) -> PythonTupleTypeNamesContract: ...


class PythonPrimaryCallBundleContract(Protocol):
    """Responsibilities: _call rules_, _decorator rules_."""

    @property
    def call_rules(self) -> PythonCallRulesContract: ...

    @property
    def decorator_rules(self) -> PythonDecoratorRuleContract: ...

    @property
    def decorator_aliases(self) -> PythonDecoratorAliasStateContract: ...
