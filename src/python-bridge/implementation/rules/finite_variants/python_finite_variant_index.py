from __future__ import annotations

import ast

from implementation.ast.protocols import PythonAstNodeIndexContract
from implementation.protocols import (
    PythonEnumVariantIndexContract,
    PythonFiniteVariantContract,
    PythonLiteralVariantIndexContract,
)
from implementation.rules.finite_variants.python_discriminated_union_index import (
    PythonDiscriminatedUnionIndex,
)
from implementation.rules.finite_variants.python_enum_variant_index import (
    PythonEnumVariantIndex,
)
from implementation.rules.finite_variants.python_finite_variant import (
    PythonFiniteVariant,
)
from implementation.rules.finite_variants.python_literal_variant_index import (
    PythonLiteralVariantIndex,
)
from implementation.types import PythonNameSetIndex


class PythonFiniteVariantIndex:
    """Responsibilities: _finite variant source indexing_, _variant member lookup_."""

    _members: PythonNameSetIndex
    _discriminants: dict[str, str]
    _literal_index: PythonLiteralVariantIndexContract
    _discriminated_union_index: PythonDiscriminatedUnionIndex
    _enum_index: PythonEnumVariantIndexContract
    _variants: dict[str, PythonFiniteVariantContract]
    _node_index: PythonAstNodeIndexContract

    def __init__(self, node_index: PythonAstNodeIndexContract) -> None:
        """Responsibilities: _finite variant index initialization_."""
        self._members = {}
        self._discriminants = {}
        self._variants = {}
        self._node_index = node_index
        self._literal_index = PythonLiteralVariantIndex(
            self._members,
            self._discriminants,
        )
        self._discriminated_union_index = PythonDiscriminatedUnionIndex(
            self._members,
            self._discriminants,
            node_index,
        )
        self._enum_index = PythonEnumVariantIndex(self._members)

    def add_source(self, tree: ast.AST) -> None:
        """Responsibilities: _source finite type indexing_."""
        if type(tree) is not ast.Module:
            return
        self._members.clear()
        self._discriminants.clear()
        self._variants.clear()
        self._literal_index.prepare_imports(tree)
        self._discriminated_union_index.prepare_imports(tree)
        self._enum_index.prepare_imports(tree)
        nodes = self._node_index.nodes(tree)
        self._discriminated_union_index.add_source(tree)
        for node in nodes:
            self._enum_index.append_declaration(node)
            self._literal_index.append_alias(node)

    def variant(self, name: str) -> PythonFiniteVariantContract:
        """Responsibilities: _finite variant definition lookup_."""
        cached = self._variants.get(name)
        if cached is not None:
            return cached
        result = PythonFiniteVariant(
            name in self._members,
            self._members.get(name, set()),
            self._discriminants.get(name, ""),
        )
        self._variants.update({name: result})
        return result
