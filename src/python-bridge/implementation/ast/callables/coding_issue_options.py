from __future__ import annotations

import ast
from dataclasses import dataclass

from implementation.ast.protocols import (
    PythonAstNodeIndexContract,
    PythonSourceSegmentsContract,
)
from implementation.references.protocols import PythonContainerKeysContract
from implementation.rules.protocols import (
    PythonExpressionBoundaryContract,
    PythonPredicateConditionContract,
    PythonTerminalBranchContract,
)
from implementation.references.protocols import (
    PythonContainerAliasesContract,
    PythonContainerValuesContract,
    PythonReferenceAliasesContract,
    PythonScopedTypeAliasesContract,
)
from implementation.types import JsonObject


@dataclass(frozen=True)
class PythonCodingIssueSource:
    """Responsibilities: _source tree ownership_, _syntax source segments_."""

    tree: ast.AST
    source: str
    source_segments: PythonSourceSegmentsContract
    node_index: PythonAstNodeIndexContract
    expression_boundary: PythonExpressionBoundaryContract


@dataclass(frozen=True)
class PythonCodingIssueContainerAliases:
    """Responsibilities: _container alias groups_, _alias analysis scope_."""

    container_aliases: PythonContainerAliasesContract
    union_container_aliases: PythonContainerAliasesContract
    field_container_aliases: PythonContainerAliasesContract
    simple_container_aliases: PythonContainerAliasesContract
    subtest_container_aliases: PythonContainerAliasesContract
    factory_container_aliases: PythonContainerAliasesContract
    exception_container_aliases: PythonContainerAliasesContract
    dynamic_container_aliases: PythonContainerAliasesContract
    decorator_container_aliases: PythonContainerAliasesContract


@dataclass(frozen=True)
class PythonCodingIssueValueAliases:
    """Responsibilities: _container value aliases_, _type and reference aliases_."""

    container_values: PythonContainerValuesContract
    container_keys: PythonContainerKeysContract
    type_aliases: PythonScopedTypeAliasesContract
    reference_aliases: PythonReferenceAliasesContract


@dataclass(frozen=True)
class PythonCodingIssueAliases:
    """Responsibilities: _container alias state_, _value alias state_."""

    containers: PythonCodingIssueContainerAliases
    values: PythonCodingIssueValueAliases


@dataclass(frozen=True)
class PythonCodingIssueRules:
    """Responsibilities: _terminal branch rules_, _predicate condition rules_."""

    terminal_branches: PythonTerminalBranchContract
    python_predicate_condition: PythonPredicateConditionContract


class PythonCodingIssueCollectorOptions:
    """Responsibilities: _source and alias inputs_, _rule evaluation dependencies_."""

    source: PythonCodingIssueSource
    aliases: PythonCodingIssueAliases
    rules: PythonCodingIssueRules

    def __init__(
        self,
        source: PythonCodingIssueSource,
        aliases: PythonCodingIssueAliases,
        rules: PythonCodingIssueRules,
    ) -> None:
        """Responsibilities: _coding issue dependency initialization_."""
        self.source: PythonCodingIssueSource = source
        self.aliases: PythonCodingIssueAliases = aliases
        self.rules: PythonCodingIssueRules = rules

    def source_data(self) -> JsonObject:
        """Responsibilities: _source dependency data_."""
        return self.source.__dict__

    def alias_data(self) -> JsonObject:
        """Responsibilities: _alias dependency data_."""
        return {**self.aliases.containers.__dict__, **self.aliases.values.__dict__}

    def rule_data(self) -> JsonObject:
        """Responsibilities: _rule dependency data_."""
        return self.rules.__dict__
