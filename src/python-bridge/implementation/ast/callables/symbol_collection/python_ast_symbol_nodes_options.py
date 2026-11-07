from __future__ import annotations

import ast
from dataclasses import dataclass

from implementation.ast.protocols import (
    PythonAstNodeIndexContract,
    PythonCallableArgumentsContract,
    PythonTypeDeclarationCollectorContract,
)
from protocols import PythonModuleInstanceCollectorContract


@dataclass(frozen=True)
class PythonAstSymbolNodesOptions:
    """Responsibilities: _symbol analysis inputs_."""

    tree: ast.Module
    node_index: PythonAstNodeIndexContract
    callable_arguments: PythonCallableArgumentsContract
    type_collector: PythonTypeDeclarationCollectorContract
    instance_collector: PythonModuleInstanceCollectorContract
