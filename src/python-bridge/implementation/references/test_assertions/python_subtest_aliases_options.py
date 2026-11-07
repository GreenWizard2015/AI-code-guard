from __future__ import annotations

import ast
from dataclasses import dataclass

from implementation.ast.protocols import PythonAstNodeIndexContract
from implementation.references.protocols import (
    PythonContainerAliasesContract,
    PythonContainerKeysContract,
    PythonReferenceAliasesContract,
)


@dataclass(frozen=True)
class PythonSubtestAliasesOptions:
    """Responsibilities: _subtest source state_, _alias resolver dependencies_."""

    tree: ast.AST
    node_index: PythonAstNodeIndexContract
    container_aliases: PythonContainerAliasesContract
    container_keys: PythonContainerKeysContract
    assignment_aliases: PythonReferenceAliasesContract
