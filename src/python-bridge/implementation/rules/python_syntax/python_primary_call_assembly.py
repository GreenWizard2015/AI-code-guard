from __future__ import annotations

import ast
from dataclasses import dataclass

from implementation.ast.protocols import PythonCallableConditionContextContract
from implementation.protocols import PythonCallAliasStateContract
from implementation.references.aliases.python_reference_aliases import (
    PythonReferenceAliases,
)
from implementation.references.protocols import (
    PythonAssignedDescriptorIndexContract,
    PythonDecoratorAliasesContract,
    PythonDecoratorRulesContract,
)
from implementation.rules.call_analysis.call_rules import CallRules, CallRulesOptions
from implementation.rules.call_analysis.python_call_alias_state import (
    PythonCallAliasState,
)
from implementation.rules.call_analysis.python_call_classification import (
    PythonCallClassification,
)
from implementation.rules.call_analysis.python_callable_condition_context import (
    PythonCallableConditionContext,
)
from implementation.rules.protocols import (
    PythonCallRulesContract,
    PythonCodingIssueComponentContextContract,
)
from implementation.rules.python_syntax.decorators.python_decorator_alias_state import (
    PythonDecoratorAliasState,
)
from implementation.rules.python_syntax.decorators.python_decorator_rules import (
    PythonDecoratorRules,
)


@dataclass(frozen=True)
class PythonPrimaryCallBundle:
    """Responsibilities: _invocation policy_, _decorator policy_."""

    call_rules: PythonCallRulesContract
    decorator_rules: PythonDecoratorRulesContract
    decorator_aliases: PythonDecoratorAliasesContract


class PythonPrimaryCallAssembly:
    """Responsibilities: _invocation policy_, _decorator policy_."""

    _context: PythonCodingIssueComponentContextContract

    def _call_rules(
        self,
        aliases: PythonCallAliasStateContract,
        condition_context: PythonCallableConditionContextContract,
    ) -> PythonCallRulesContract:
        """Responsibilities: _invocation classification_, _rule dependency graph_."""
        context = self._context
        classification = PythonCallClassification(
            context.reference_aliases, aliases, condition_context
        )
        options = CallRulesOptions(
            context.tree,
            context.node_index,
            aliases,
            context.reference_aliases,
            classification,
            condition_context,
        )
        return CallRules(options)

    def _decorator_rules(
        self,
        aliases: PythonDecoratorAliasesContract,
        assigned_descriptors: PythonAssignedDescriptorIndexContract,
    ) -> PythonDecoratorRulesContract:
        """Responsibilities: _decorator dependency graph_."""
        return PythonDecoratorRules(
            self._context.decorator_container_aliases,
            PythonReferenceAliases(),
            aliases,
            assigned_descriptors,
        )

    def __init__(self, context: PythonCodingIssueComponentContextContract) -> None:
        """Responsibilities: _context ownership_."""
        self._context: PythonCodingIssueComponentContextContract = context

    def condition_context(self) -> PythonCallableConditionContextContract:
        """Responsibilities: _callable scope_, _parent indexing_."""
        context = self._context
        nodes = context.node_index.nodes(context.tree)
        scopes = context.node_index.scopes(context.tree)
        parents = {
            id(child): node for node in nodes for child in ast.iter_child_nodes(node)
        }
        return PythonCallableConditionContext(nodes, scopes, parents)

    def call_state(self) -> PythonPrimaryCallBundle:
        """Responsibilities: _invocation dependency state_."""
        aliases = PythonCallAliasState()
        call_rules = self._call_rules(aliases, self.condition_context())
        decorator_aliases = PythonDecoratorAliasState(
            self._context.decorator_container_aliases, PythonReferenceAliases()
        )
        decorator_rules = self._decorator_rules(
            decorator_aliases, decorator_aliases.assigned_descriptors
        )
        return PythonPrimaryCallBundle(call_rules, decorator_rules, decorator_aliases)
