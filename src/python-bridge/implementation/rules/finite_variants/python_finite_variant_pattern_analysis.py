from __future__ import annotations

import ast

from implementation.protocols import (
    PythonFiniteVariantIndexContract,
)


class PythonFiniteVariantPatternAnalysis:
    """Responsibilities: _variant pattern extraction_, _fallback target verification_."""

    _type_index: PythonFiniteVariantIndexContract

    def _mapping_member(
        self,
        pattern: ast.MatchMapping,
        source_discriminant: str,
    ) -> str:
        """Responsibilities: _tagged source case extraction_."""
        for key, value_pattern in zip(pattern.keys, pattern.patterns, strict=False):
            if type(key) is not ast.Constant or key.value != source_discriminant:
                continue
            if type(value_pattern) is not ast.MatchValue:
                continue
            value = value_pattern.value
            if type(value) is ast.Constant and type(value.value) is str:
                return value.value
        return ""

    def _literal_member(self, pattern: ast.MatchValue, source: str) -> str:
        """Responsibilities: _source value case extraction_."""
        value = pattern.value
        if type(value) is ast.Constant and type(value.value) is str:
            return value.value
        if type(value) is ast.Attribute and type(value.value) is ast.Name:
            if value.value.id == source:
                return value.attr
        return ""

    def _target_tag(self, value: ast.Dict, target_discriminant: str) -> str:
        """Responsibilities: _target tagged value extraction_."""
        for key, item in zip(value.keys, value.values, strict=False):
            if type(key) is not ast.Constant or key.value != target_discriminant:
                continue
            if type(item) is ast.Constant and type(item.value) is str:
                return item.value
        return ""

    def __init__(self, type_index: PythonFiniteVariantIndexContract) -> None:
        """Responsibilities: _pattern analysis dependency ownership_."""
        self._type_index = type_index

    def case_member(
        self,
        source_case: ast.match_case,
        source_type_name: str,
        source_discriminant: str,
    ) -> str:
        """Responsibilities: _source case identity resolution_."""
        pattern = source_case.pattern
        if type(pattern) is ast.MatchMapping:
            return self._mapping_member(pattern, source_discriminant)
        if type(pattern) is ast.MatchValue:
            return self._literal_member(pattern, source_type_name)
        return ""

    def target_variant(
        self,
        value: ast.AST,
        target_type_name: str,
        target_discriminant: str,
    ) -> bool:
        """Responsibilities: _fallback target identity verification_."""
        variant = self._type_index.variant(target_type_name)
        if target_discriminant and type(value) is ast.Dict:
            target_member = self._target_tag(value, target_discriminant)
            return variant.member_present(target_member)
        if type(value) is ast.Attribute and type(value.value) is ast.Name:
            if value.value.id == target_type_name:
                return variant.member_present(value.attr)
        if type(value) is ast.Constant and type(value.value) is str:
            return variant.member_present(value.value)
        return False
