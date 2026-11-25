from __future__ import annotations

import ast
from typing import Protocol

from implementation.ast.protocols import PythonAstNodeIndexContract
from implementation.references.protocols import PythonReferenceAliasesContract
from implementation.rules.protocols import PythonArrayTypeInspectorContract, PythonReturnArrayAnalyzerContract
from implementation.types import PythonAstCallableDeclarations


class PythonArrayCallOptionsContract(Protocol):
    """Responsibilities: _array call analysis inputs_."""

    @property
    def tree(self) -> ast.AST: ...

    @property
    def node_index(self) -> PythonAstNodeIndexContract: ...

    @property
    def type_inspector(self) -> PythonArrayTypeInspectorContract: ...

    @property
    def return_analyzer(self) -> PythonReturnArrayAnalyzerContract: ...

    @property
    def assignment_aliases(self) -> PythonReferenceAliasesContract: ...

    @property
    def callable_declarations(self) -> PythonAstCallableDeclarations: ...
