from __future__ import annotations

import ast
from dataclasses import dataclass

from implementation.ast.protocols import (
    PythonAstNodeIndexContract,
    PythonFunctionSelectorContract,
    PythonSourceSegmentsContract,
    PythonTestAssertionDataContract,
)
from implementation.references.protocols import PythonContainerAliasesContract, PythonScopedTypeAliasesContract


@dataclass(frozen=True)
class PythonFunctionNodesOptions:
    """Responsibilities: _Python syntax tree input_, _callable collection dependencies_."""

    tree: ast.Module
    node_index: PythonAstNodeIndexContract
    source_segments: PythonSourceSegmentsContract
    container_aliases: PythonContainerAliasesContract
    function_selector: PythonFunctionSelectorContract
    test_assertion_data: PythonTestAssertionDataContract
    type_aliases: PythonScopedTypeAliasesContract
