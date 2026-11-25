from __future__ import annotations

import ast
from typing import Protocol

from implementation.ast.protocols import (
    PythonAstNodeIndexContract,
    PythonFunctionSelectorContract,
    PythonSourceSegmentsContract,
    PythonTestAssertionDataContract,
)
from implementation.references.protocols import PythonScopedTypeAliasesContract


class PythonFunctionNodesOptionsContract(Protocol):
    """Responsibilities: _function node inputs_, _callable analyzer contracts_."""

    @property
    def tree(self) -> ast.Module: ...

    @property
    def node_index(self) -> PythonAstNodeIndexContract: ...

    @property
    def source_segments(self) -> PythonSourceSegmentsContract: ...

    @property
    def function_selector(self) -> PythonFunctionSelectorContract: ...

    @property
    def test_assertion_data(self) -> PythonTestAssertionDataContract: ...

    @property
    def type_aliases(self) -> PythonScopedTypeAliasesContract: ...
