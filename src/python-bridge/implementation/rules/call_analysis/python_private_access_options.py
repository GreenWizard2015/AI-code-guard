from __future__ import annotations

import ast
from dataclasses import dataclass

from implementation.ast.protocols import PythonAstNodeIndexContract
from implementation.protocols import PythonReflectionNamesContract
from implementation.references.decorator_protocols import (
    PythonPrivateVarsMappingContract,
)
from implementation.references.protocols import (
    PythonContainerAliasesContract,
    PythonContainerKeysContract,
)


@dataclass(frozen=True)
class PythonPrivateAccessOptions:
    """Responsibilities: _private access analysis dependencies_."""

    tree: ast.Module
    node_index: PythonAstNodeIndexContract
    container_aliases: PythonContainerAliasesContract
    container_keys: PythonContainerKeysContract
    reflection_names: PythonReflectionNamesContract
    private_vars_mapping: PythonPrivateVarsMappingContract
