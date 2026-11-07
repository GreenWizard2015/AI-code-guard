from __future__ import annotations

import ast

from implementation.ast.protocols import PythonAstNodeIndexContract
from implementation.rules.finite_variants.python_finite_variant_function_types import (
    PythonFiniteVariantFunctionTypes,
)
from implementation.rules.finite_variants.python_finite_variant_index import (
    PythonFiniteVariantIndex,
)
from implementation.rules.finite_variants.python_finite_variant_pattern_analysis import (
    PythonFiniteVariantPatternAnalysis,
)
from implementation.types import JsonObject, PythonAstParentIndex


class FiniteVariantMapping:
    """Responsibilities: _finite type mapping analysis_, _lossy fallback reporting_."""

    _tree: ast.AST
    _parents: PythonAstParentIndex
    _type_index: PythonFiniteVariantIndex
    _patterns: PythonFiniteVariantPatternAnalysis
    _function_types: PythonFiniteVariantFunctionTypes
    _node_index: PythonAstNodeIndexContract

    def _wildcard_fallback(self, fallback_match: ast.Match) -> ast.AST:
        """Responsibilities: _wildcard fallback expression selection_."""
        for case in fallback_match.cases:
            if type(case.pattern) is not ast.MatchAs or case.pattern.name is not None:
                continue
            if len(case.body) != 1 or type(case.body[0]) is not ast.Return:
                return fallback_match
            fallback = case.body[0].value
            if fallback is None:
                return fallback_match
            return fallback
        return fallback_match

    def _lossy_fallback(self, match_node: ast.Match, target_name: str, discriminant: str) -> bool:
        """Responsibilities: _fallback loss detection_."""
        fallback = self._wildcard_fallback(match_node)
        if fallback is match_node:
            return False
        if type(fallback) is ast.Name and type(match_node.subject) is ast.Name:
            if fallback.id == match_node.subject.id:
                return False
        return self._patterns.target_variant(fallback, target_name, discriminant)

    def _mapped_cases(
        self,
        cases_match: ast.Match,
        source_variant_name: str,
        source_discriminant: str,
    ) -> set[str]:
        """Responsibilities: _finite source case collection_."""
        mapped: set[str] = set()
        for case in cases_match.cases:
            mapped.add(
                self._patterns.case_member(
                    case,
                    source_variant_name,
                    source_discriminant,
                ),
            )
        return mapped

    def _known_mapping_types(
        self,
        source_type_name: str,
        target_type_name: str,
    ) -> bool:
        """Responsibilities: _variant mapping_."""
        if not source_type_name:
            return False
        if not self.supports_type(source_type_name):
            return False
        return self.supports_type(target_type_name)

    def _has_unmapped_source(
        self,
        coverage_match: ast.Match,
        source_variant_name: str,
    ) -> bool:
        """Responsibilities: _source variant coverage validation_."""
        source_variant = self._type_index.variant(source_variant_name)
        discriminant = source_variant.discriminant()
        source_members = source_variant.members()
        mapped_cases = self._mapped_cases(
            coverage_match,
            source_variant_name,
            discriminant,
        )
        mapped_cases.intersection_update(source_members)
        if not mapped_cases:
            return False
        return not source_members.issubset(mapped_cases)

    def _incomplete_mapping(
        self,
        candidate_match: ast.Match,
        result_variant_name: str,
    ) -> bool:
        """Responsibilities: _finite mapping completeness_."""
        source_variant_name = self._function_types.source_type(candidate_match)
        if not self._known_mapping_types(source_variant_name, result_variant_name):
            return False
        target_discriminant = self._type_index.variant(
            result_variant_name,
        ).discriminant()
        if not self._lossy_fallback(
            candidate_match,
            result_variant_name,
            target_discriminant,
        ):
            return False
        return self._has_unmapped_source(candidate_match, source_variant_name)

    def _append_match(
        self,
        reported_match: ast.Match,
        issues: list[JsonObject],
    ) -> None:
        """Responsibilities: _lossy finite mapping diagnostics_."""
        result_variant_name = self._function_types.target_type(reported_match)
        if not result_variant_name:
            return
        if self._incomplete_mapping(reported_match, result_variant_name):
            issues.append(
                {
                    "line": reported_match.lineno - 1,
                    "kind": "finite-variant-mapping-is-incomplete",
                },
            )

    def __init__(self, tree: ast.AST, node_index: PythonAstNodeIndexContract) -> None:
        """Responsibilities: _source index ownership_."""
        self._tree = tree
        self._parents = {}
        self._node_index = node_index
        self._type_index = PythonFiniteVariantIndex(node_index)
        self._patterns = PythonFiniteVariantPatternAnalysis(self._type_index)
        self._function_types = PythonFiniteVariantFunctionTypes(tree, self._parents)

    def prepare(self) -> None:
        """Responsibilities: _finite type index construction_."""
        self._parents.clear()
        for node in self._node_index.nodes(self._tree):
            for child in self._node_index.children(node):
                self._parents.update({child: node})
        self._type_index.add_source(self._tree)

    def supports_type(self, name: str) -> bool:
        """Responsibilities: _finite type availability_."""
        variant = self._type_index.variant(name)
        if not variant.supports():
            return False
        return variant.member_count() > 0

    def issues(self) -> list[JsonObject]:
        """Responsibilities: _finite variant mapping diagnostics_."""
        issues: list[JsonObject] = []
        for node in self._node_index.nodes(self._tree):
            if type(node) is ast.Match:
                self._append_match(node, issues)
        return issues
