from __future__ import annotations

import ast
from dataclasses import dataclass

from implementation.ast.protocols import PythonAstNodeIndexContract, PythonCallableConditionContextContract
from implementation.protocols import PythonCallAliasStateContract, PythonCallClassificationContract
from implementation.references.protocols import PythonReferenceAliasesContract
from implementation.rules.protocols import PythonNameBindingIndexContract, PythonStructuralMemberLookupContract
from implementation.types import PythonAstParentIndex


@dataclass(frozen=True)
class PythonImplementationDowncastCandidate:
    """Responsibilities: _Protocol downcast candidate identity_."""

    callable_scope: ast.AST
    receiver_name: str
    implementation_name: str


@dataclass
class CallRulesOptions:
    """Responsibilities: _invocation syntax_, _reflection aliases_."""

    tree: ast.AST
    node_index: PythonAstNodeIndexContract
    container_aliases: PythonCallAliasStateContract
    reference_aliases: PythonReferenceAliasesContract
    python_call_classification: PythonCallClassificationContract
    callable_condition_context: PythonCallableConditionContextContract
    binding_index: PythonNameBindingIndexContract


@dataclass(frozen=True)
class PythonCallableScopeOptions:
    """Responsibilities: _callable scope analysis inputs_."""

    tree: ast.AST
    definition: ast.AST
    parents: PythonAstParentIndex
    contracts: PythonStructuralMemberLookupContract
    node_index: PythonAstNodeIndexContract
    binding_index: PythonNameBindingIndexContract
