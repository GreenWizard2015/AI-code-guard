from __future__ import annotations

import ast
from dataclasses import dataclass

from implementation.ast.protocols import PythonAstNodeIndexContract
from implementation.references.alias_types import (
    PythonSubtestAliasMap,
    PythonSubtestAliasSourceIndex,
    PythonSubtestAssignmentList,
    PythonSubtestNameSet,
)
from implementation.references.protocols import (
    PythonContainerAliasesContract,
    PythonContainerKeysContract,
    PythonContainerValuesContract,
    PythonReferenceAliasesContract,
)


@dataclass(frozen=True)
class PythonTestAssertionAliasNames:
    """Responsibilities: _assertion aliases_, _exception aliases_."""

    assertion_names: frozenset[str]
    exception_names: frozenset[str]


@dataclass(frozen=True)
class PythonTestAssertionAliasOptions:
    """Responsibilities: _assertion AST_, _alias resolution dependencies_."""

    node: ast.AST
    node_index: PythonAstNodeIndexContract
    container_aliases: PythonContainerAliasesContract
    container_keys: PythonContainerKeysContract
    container_values: PythonContainerValuesContract
    assignment_aliases: PythonReferenceAliasesContract


@dataclass
class PythonSubtestAliasAnalysisState:
    """Responsibilities: _source assignment history_, _subtest alias transitions_."""

    assignments: PythonSubtestAssignmentList
    receivers: PythonSubtestAliasMap
    subtests: PythonSubtestNameSet
    assignment_aliases: PythonSubtestAliasSourceIndex
