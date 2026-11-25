from __future__ import annotations

import ast
from typing import Protocol

from implementation.ast.protocols import (
    PythonAstNodeIndexContract,
    PythonCallableConditionContextContract,
)
from implementation.protocols import (
    PythonCallAliasStateContract,
    PythonCallClassificationContract,
)
from implementation.references.protocols import PythonReferenceAliasesContract
from implementation.rules.protocols import (
    PythonNameBindingIndexContract,
    PythonStructuralMemberLookupContract,
)
from implementation.types import PythonAstParentIndex


class CallRulesOptionsContract(Protocol):
    """Responsibilities: _call rule input tree_, _rule collaboration access_."""

    @property
    def tree(self) -> ast.AST: ...

    @property
    def node_index(self) -> PythonAstNodeIndexContract: ...

    @property
    def container_aliases(self) -> PythonCallAliasStateContract: ...

    @property
    def reference_aliases(self) -> PythonReferenceAliasesContract: ...

    @property
    def python_call_classification(self) -> PythonCallClassificationContract: ...

    @property
    def callable_condition_context(self) -> PythonCallableConditionContextContract: ...

    @property
    def binding_index(self) -> PythonNameBindingIndexContract: ...


class PythonCallableScopeOptionsContract(Protocol):
    """Responsibilities: _callable scope nodes_, _scope dependencies_."""

    @property
    def tree(self) -> ast.AST: ...

    @property
    def definition(self) -> ast.AST: ...

    @property
    def parents(self) -> PythonAstParentIndex: ...

    @property
    def contracts(self) -> PythonStructuralMemberLookupContract: ...

    @property
    def node_index(self) -> PythonAstNodeIndexContract: ...

    @property
    def binding_index(self) -> PythonNameBindingIndexContract: ...


class PythonImplementationDowncastCandidateContract(Protocol):
    """Responsibilities: _callable downcast scope_, _receiver and class names_."""

    @property
    def callable_scope(self) -> ast.AST: ...

    @property
    def receiver_name(self) -> str: ...

    @property
    def implementation_name(self) -> str: ...
