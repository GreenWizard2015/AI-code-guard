from __future__ import annotations

from implementation.references.python_unbounded_type_rules import (
    PythonUnboundedTypeRules,
)
from implementation.rules.protocols import (
    PythonCodingIssueComponentContextContract,
    PythonCodingIssueTypeBundleContract,
    PythonUnboundedTypeRulesContract,
    PythonUnionRulesContract,
)
from implementation.rules.type_rules.python_typing_aliases import PythonTypingAliases
from implementation.rules.types import PythonCodingIssueTypeBundle
from implementation.rules.union.union_annotation_rules import UnionAnnotationRules
from implementation.rules.union.union_rules import UnionRules
from implementation.rules.union.union_rules_options import UnionRulesOptions


class PythonCodingIssueTypeState:
    """Responsibilities: _union type analysis_, _dynamic type analysis_."""

    _union_rules: PythonUnionRulesContract
    _unbounded_rules: PythonUnboundedTypeRulesContract

    def __init__(self, context: PythonCodingIssueComponentContextContract) -> None:
        """Responsibilities: _type state initialization_."""
        typing_aliases = PythonTypingAliases(
            context.aliases().values.reference_aliases,
            context.aliases().containers.union_container_aliases,
        )
        annotation_rules = UnionAnnotationRules(
            3,
            context.node_index(),
            typing_aliases,
        )
        options = UnionRulesOptions(
            context,
            typing_aliases,
            annotation_rules,
        )
        self._union_rules: PythonUnionRulesContract = UnionRules(options)
        self._unbounded_rules: PythonUnboundedTypeRulesContract = PythonUnboundedTypeRules(
            context.tree(),
            context.node_index(),
            context.aliases().values.type_aliases,
        )

    def union_rules(self) -> PythonUnionRulesContract:
        """Responsibilities: _union rule access_."""
        return self._union_rules

    def unbounded_rules(self) -> PythonUnboundedTypeRulesContract:
        """Responsibilities: _unbounded rule access_."""
        return self._unbounded_rules

    def bundle(self) -> PythonCodingIssueTypeBundleContract:
        """Responsibilities: _type rule bundle assembly_."""
        union_rules = self.union_rules()
        unbounded_type_rules = self.unbounded_rules()
        return PythonCodingIssueTypeBundle(
            union_rules,
            unbounded_type_rules,
        )
