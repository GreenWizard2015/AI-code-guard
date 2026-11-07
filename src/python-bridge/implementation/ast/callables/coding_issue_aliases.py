from __future__ import annotations

from dataclasses import dataclass

from implementation.ast.callables.coding_issue_protocols import (
    PythonCodingIssueContainerAliasesContract,
    PythonCodingIssueValueAliasesContract,
)
from implementation.references.protocols import (
    PythonContainerAliasesContract,
    PythonContainerKeysContract,
    PythonContainerValuesContract,
    PythonReferenceAliasesContract,
    PythonScopedTypeAliasesContract,
)


@dataclass(frozen=True)
class PythonCodingIssueContainerAliases:
    """Responsibilities: _rule container alias groups_."""

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
    """Responsibilities: _rule value aliases_."""

    container_values: PythonContainerValuesContract
    container_keys: PythonContainerKeysContract
    type_aliases: PythonScopedTypeAliasesContract
    reference_aliases: PythonReferenceAliasesContract


@dataclass(frozen=True)
class PythonCodingIssueAliases:
    """Responsibilities: _coding issue alias groups_."""

    containers: PythonCodingIssueContainerAliasesContract
    values: PythonCodingIssueValueAliasesContract
