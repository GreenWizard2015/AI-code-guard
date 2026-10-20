from __future__ import annotations

from implementation.rules.protocols import PythonCodingIssueComponentContextContract
from implementation.rules.protocols import (
    PythonUnboundedTypeRulesContract,
    PythonUnionRulesContract,
)
from implementation.references.python_unbounded_type_rules import (
    PythonUnboundedTypeRules,
)
from implementation.rules.type_rules.python_typing_aliases import PythonTypingAliases
from implementation.rules.union.union_annotation_rules import UnionAnnotationRules
from implementation.rules.union.union_rules import UnionRules
from implementation.rules.union.union_rules_options import UnionRulesOptions


class PythonCodingIssueTypeState:
    """Responsibilities: _union type analysis_, _dynamic type analysis_."""

    _union_rules: PythonUnionRulesContract
    _unbounded_rules: PythonUnboundedTypeRulesContract

    def __init__(self, context: PythonCodingIssueComponentContextContract) -> None:
        """Responsibilities: _type state initialization_."""
        typing_aliases = PythonTypingAliases(context.reference_aliases)
        annotation_rules = UnionAnnotationRules(
            3, context.node_index, typing_aliases, context.union_container_aliases
        )
        options = UnionRulesOptions()
        options.tree_value = context.tree
        options.node_index_value = context.node_index
        options.container_aliases_value = context.union_container_aliases
        options.typing_aliases_value = typing_aliases
        options.annotation_rules_value = annotation_rules
        self._union_rules: PythonUnionRulesContract = UnionRules(options)
        self._unbounded_rules: PythonUnboundedTypeRulesContract = (
            PythonUnboundedTypeRules(
                context.tree, context.node_index, context.type_aliases
            )
        )

    def union_rules(self) -> PythonUnionRulesContract:
        """Responsibilities: _union rule access_."""
        return self._union_rules

    def unbounded_rules(self) -> PythonUnboundedTypeRulesContract:
        """Responsibilities: _unbounded rule access_."""
        return self._unbounded_rules
