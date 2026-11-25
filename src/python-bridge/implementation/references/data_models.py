from __future__ import annotations

import ast
from dataclasses import dataclass, field
from typing import TYPE_CHECKING

from implementation.references.alias_types import AssignmentAliasCache, TreeAliasCache
from implementation.types import JsonObject

if TYPE_CHECKING:
    from implementation.references.protocols import (
        PythonAnnotationResolverContract,
        PythonReferenceBuilderContract,
        PythonReferenceContextContract,
    )


@dataclass(frozen=True)
class PythonContainerItemRequest:
    """Responsibilities: _container item lookup expression_, _lookup key_."""

    expression: ast.AST
    key: str


@dataclass
class PythonReferenceAliasState:
    """Responsibilities: _alias records_, _resolution and collection caches_."""

    aliases: list[JsonObject] = field(default_factory=list)
    alias_index: dict[str, str] = field(default_factory=dict)
    resolved_aliases: dict[str, str] = field(default_factory=dict)
    assignment_cache: AssignmentAliasCache = field(default_factory=dict)
    tree_cache: TreeAliasCache = field(default_factory=dict)


@dataclass(frozen=True)
class PythonInstanceBindingSource:
    """Responsibilities: _source binding identity_."""

    node: ast.AST
    owner: str
    annotation_resolver: PythonAnnotationResolverContract


@dataclass
class PythonReferenceState:
    """Responsibilities: _reference context storage_, _reference builder records_."""

    context: PythonReferenceContextContract = field(init=False)
    builder: PythonReferenceBuilderContract = field(init=False)
    references: list[JsonObject] = field(default_factory=list)
    current_owner: str = ""
