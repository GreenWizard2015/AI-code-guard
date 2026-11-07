from __future__ import annotations

import ast
from collections.abc import Callable
from dataclasses import dataclass
from typing import TypeAlias

JsonValueReference: TypeAlias = "JsonValue"
JsonValueList: TypeAlias = list[JsonValueReference]
JsonValueMap: TypeAlias = dict[str, JsonValueReference]
JsonScalar: TypeAlias = str | int | float | bool | None
JsonValue: TypeAlias = JsonScalar | JsonValueList | JsonValueMap
JsonObject: TypeAlias = dict[str, JsonValue]
PythonProxyAliasAssignment: TypeAlias = tuple[int, str, str]
PythonProxyAliasRecords: TypeAlias = dict[str, list[PythonProxyAliasAssignment]]
PythonAstParents: TypeAlias = dict[int, list[ast.AST]]
PythonAstNodeList: TypeAlias = list[ast.AST]
PythonAstNodeListIndex: TypeAlias = dict[ast.AST, PythonAstNodeList]
PythonAstClassDefinitions: TypeAlias = dict[ast.AST, list[ast.ClassDef]]
PythonAstCallableDeclarations: TypeAlias = dict[str, PythonAstNodeList]
PythonAstScopeNames: TypeAlias = dict[ast.AST, str]
PythonAstScopeIndex: TypeAlias = dict[ast.AST, PythonAstScopeNames]
PythonNameSet: TypeAlias = set[str]
PythonNameSetsByCallable: TypeAlias = dict[ast.AST, PythonNameSet]
PythonCallableOwners: TypeAlias = dict[ast.AST, ast.AST]
PythonBindingScopesByNode: TypeAlias = dict[ast.AST, str]
PythonLexicalScopeChain: TypeAlias = tuple[str, ...]
PythonAstNodeTypeSet: TypeAlias = set[type[ast.AST]]
PythonGenericNames: TypeAlias = frozenset[str]
PythonCallableAstNode: TypeAlias = ast.FunctionDef | ast.AsyncFunctionDef
LiteralMetadata: TypeAlias = dict[str, list[JsonObject]]
PythonOperatorKinds: TypeAlias = set[type[ast.AST]]
PythonDecoratorAliasGroups: TypeAlias = dict[str, set[str]]
CallablePythonRuleStage: TypeAlias = Callable[[ast.AST], list[JsonObject]]
CallablePythonAstIssueAnalysis: TypeAlias = Callable[[ast.AST], list[JsonObject]]
CallablePythonPrepare: TypeAlias = Callable[[ast.AST], None]


@dataclass(frozen=True)
class PythonRuleStageEntry:
    """Responsibilities: _Python rule dispatch_."""

    stage: CallablePythonRuleStage
    name: str


PythonAstParentIndex: TypeAlias = dict[ast.AST, ast.AST]
PythonCharacterColumnIndex: TypeAlias = dict[int, int]
PythonCharacterColumnsByLine: TypeAlias = dict[str, PythonCharacterColumnIndex]
PythonNameSetIndex: TypeAlias = dict[str, set[str]]
PythonStructuralMembersIndex: TypeAlias = dict[str, set[str]]
PythonStructuralImplementationsIndex: TypeAlias = dict[
    str,
    PythonStructuralMembersIndex,
]
PythonCallAliasEntries: TypeAlias = dict[str, ast.AST]
PythonAnnotatedFieldMap: TypeAlias = dict[str, ast.expr]
PythonClassFieldMap: TypeAlias = dict[str, PythonAnnotatedFieldMap]
PythonCreationAssignments: TypeAlias = list[ast.AnnAssign]
PythonAssignmentsByCreation: TypeAlias = dict[ast.Call, PythonCreationAssignments]
PythonReceiverMethods: TypeAlias = set[str]
PythonMethodsByReceiver: TypeAlias = dict[str, PythonReceiverMethods]


@dataclass(frozen=True)
class PythonTimeName:
    """Responsibilities: _time module identity_, _time callable identity_."""

    module: str
    callable_name: str


@dataclass
class PythonImportedNames:
    """Responsibilities: _symbol name index_."""

    names: set[str]
    modules: set[str]
