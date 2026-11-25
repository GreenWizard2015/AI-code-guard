from __future__ import annotations

import ast
from collections.abc import Callable
from typing import Protocol, TypeAlias

from implementation.ast.protocols import (
    PythonAstNodeIndexContract,
    PythonCodingIssueTimingContract,
    PythonSourceSegmentsContract,
)
from implementation.references.protocols import (
    PythonContainerAliasesContract,
    PythonContainerKeysContract,
    PythonContainerValuesContract,
    PythonReferenceAliasesContract,
    PythonScopedTypeAliasesContract,
)
from implementation.types import CallablePythonRuleStage, JsonObject


class PythonCodingIssueNodeContract(Protocol):
    """Responsibilities: _timed AST rule dispatch_."""

    def timed_stage(
        self,
        node: ast.AST,
        stage: CallablePythonRuleStage,
        stage_name: str,
    ) -> list[JsonObject]: ...

    def timed_precedence(self, node: ast.AST) -> list[JsonObject]: ...


class PythonRuleStageEntryContract(Protocol):
    """Responsibilities: _rule stage operation_, _rule timing label_."""

    @property
    def stage(self) -> CallablePythonRuleStage: ...

    @property
    def name(self) -> str: ...


class PythonAstCodingIssueInputsContract(Protocol):
    """Responsibilities: _coding issue source_, _AST reference dependencies_."""

    @property
    def tree(self) -> ast.Module: ...

    @property
    def source(self) -> str: ...

    @property
    def node_index(self) -> PythonAstNodeIndexContract: ...

    @property
    def source_segments(self) -> PythonSourceSegmentsContract: ...

    @property
    def container_aliases(self) -> PythonContainerAliasesContract: ...

    @property
    def container_values(self) -> PythonContainerValuesContract: ...

    @property
    def container_keys(self) -> PythonContainerKeysContract: ...

    @property
    def type_aliases(self) -> PythonScopedTypeAliasesContract: ...

    @property
    def reference_aliases(self) -> PythonReferenceAliasesContract: ...


class PythonAstCodingIssueResultContract(Protocol):
    """Responsibilities: _coding issue diagnostics_, _analysis timing results_."""

    @property
    def issues(self) -> list[JsonObject]: ...

    @property
    def timings(self) -> dict[str, float]: ...


class PythonRuleNodeDispatchContract(Protocol):
    """Responsibilities: _node rule stages_, _node precedence eligibility_."""

    @property
    def stages(self) -> list[PythonRuleStageEntryContract]: ...

    @property
    def checks_precedence(self) -> bool: ...

    @property
    def checks_proxy(self) -> bool: ...


CallablePythonDispatchedNodeAnalysis: TypeAlias = Callable[
    [ast.AST, PythonRuleNodeDispatchContract],
    list[JsonObject],
]


PythonRuleNodeDispatchIndex: TypeAlias = dict[
    type[ast.AST],
    PythonRuleNodeDispatchContract,
]


class PythonCodingIssueCollectorContract(Protocol):
    """Responsibilities: _Python issue collection contract_."""

    def timing(self) -> PythonCodingIssueTimingContract: ...

    def collect(self) -> list[JsonObject]: ...


class PythonCodingIssueContainerAliasesContract(Protocol):
    """Responsibilities: _rule container alias groups_."""

    @property
    def container_aliases(self) -> PythonContainerAliasesContract: ...

    @property
    def union_container_aliases(self) -> PythonContainerAliasesContract: ...

    @property
    def field_container_aliases(self) -> PythonContainerAliasesContract: ...

    @property
    def simple_container_aliases(self) -> PythonContainerAliasesContract: ...

    @property
    def subtest_container_aliases(self) -> PythonContainerAliasesContract: ...

    @property
    def factory_container_aliases(self) -> PythonContainerAliasesContract: ...

    @property
    def exception_container_aliases(self) -> PythonContainerAliasesContract: ...

    @property
    def dynamic_container_aliases(self) -> PythonContainerAliasesContract: ...

    @property
    def decorator_container_aliases(self) -> PythonContainerAliasesContract: ...


class PythonCodingIssueValueAliasesContract(Protocol):
    """Responsibilities: _rule value alias groups_."""

    @property
    def container_values(self) -> PythonContainerValuesContract: ...

    @property
    def container_keys(self) -> PythonContainerKeysContract: ...

    @property
    def type_aliases(self) -> PythonScopedTypeAliasesContract: ...

    @property
    def reference_aliases(self) -> PythonReferenceAliasesContract: ...
