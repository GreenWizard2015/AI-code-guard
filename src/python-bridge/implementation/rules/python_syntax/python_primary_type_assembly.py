from __future__ import annotations

from dataclasses import dataclass

from implementation.protocols import (
    PythonPrimaryTypeStateContract,
    PythonTupleTypeNamesContract,
    PythonTypeFactoryNamesContract,
)
from implementation.references.aliases.python_reference_aliases import (
    PythonReferenceAliases,
    PythonReferenceAliasState,
)
from implementation.references.protocols import PythonExceptionAliasStateContract
from implementation.rules.coding_issues.constructor_rules import ConstructorRules
from implementation.rules.coding_issues.primary_rule_protocols import (
    PythonPrimaryCallBundleContract,
    PythonPrimaryRuleSetContract,
)
from implementation.rules.coding_issues.primary_rule_set import PythonPrimaryRuleSet
from implementation.rules.constants import PYTHON_BUILTINS_MODULE
from implementation.rules.protocols import (
    PythonCodingIssueComponentContextContract,
    PythonDynamicTypeRulesContract,
    PythonExceptionRulesContract,
)
from implementation.rules.python_syntax.dynamic_type_rules import (
    PythonDynamicTypeRules,
    PythonDynamicTypeRulesOptions,
)
from implementation.rules.python_syntax.exceptions.python_exception_alias_state import (
    PythonExceptionAliasState,
)
from implementation.rules.python_syntax.exceptions.python_exception_broadness import (
    PythonExceptionBroadness,
)
from implementation.rules.python_syntax.exceptions.python_exception_multiplicity import (
    PythonExceptionMultiplicity,
)
from implementation.rules.python_syntax.exceptions.python_exception_rules import (
    PythonExceptionRules,
)
from implementation.rules.python_syntax.exceptions.python_primary_type_state import (
    PythonPrimaryTypeState,
    PythonPrimaryTypeStateOptions,
)
from implementation.rules.python_syntax.python_dynamic_type_references import (
    PythonDynamicTypeReferences,
)
from implementation.rules.python_syntax.python_primary_call_assembly import PythonPrimaryCallAssembly
from implementation.rules.python_syntax.python_tuple_type_names import (
    PythonTupleTypeNames,
)
from implementation.rules.python_syntax.python_type_factory_names import (
    PythonTypeFactoryNames,
)


@dataclass(frozen=True)
class PythonPrimaryExceptionBundle:
    """Responsibilities: _exception alias state_, _exception rule state_."""

    aliases: PythonExceptionAliasStateContract
    rules: PythonExceptionRulesContract


class PythonPrimaryTypeAssembly:
    """Responsibilities: _primary Python rules_, _exception analysis_."""

    _context: PythonCodingIssueComponentContextContract

    def _dynamic_rules(self) -> PythonDynamicTypeRulesContract:
        """Responsibilities: _dynamic type dependencies_."""
        context = self._context
        type_names: set[str] = {"type"}
        module_names: set[str] = {PYTHON_BUILTINS_MODULE}
        references = PythonDynamicTypeReferences(
            type_names,
            module_names,
            context.aliases().containers.dynamic_container_aliases,
        )
        return PythonDynamicTypeRules(
            PythonDynamicTypeRulesOptions(
                type_names,
                module_names,
                references,
                context.aliases().containers.dynamic_container_aliases,
                context.aliases().containers.dynamic_container_aliases.state(),
                context.aliases().containers.dynamic_container_aliases.container_values(),
                PythonReferenceAliases(PythonReferenceAliasState()),
            ),
        )

    def _rule_set(
        self,
        call_state: PythonPrimaryCallBundleContract,
        type_state: PythonPrimaryTypeStateContract,
    ) -> PythonPrimaryRuleSetContract:
        """Responsibilities: _primary rule dependency grouping_."""
        return PythonPrimaryRuleSet(
            call_state.call_rules,
            call_state.decorator_rules,
            call_state.decorator_aliases,
            ConstructorRules(),
            type_state.dynamic_rules(),
            type_state.exception_aliases(),
            type_state.exception_rules(),
            type_state.type_factory_names(),
            type_state.tuple_type_names(),
        )

    def __init__(self, context: PythonCodingIssueComponentContextContract) -> None:
        """Responsibilities: _type context ownership_."""
        self._context: PythonCodingIssueComponentContextContract = context

    def exception_state(self) -> PythonPrimaryExceptionBundle:
        """Responsibilities: _exception rule assembly_."""
        containers = self._context.aliases().containers.exception_container_aliases
        values = containers.container_values()
        multiplicity = PythonExceptionMultiplicity(values, PythonReferenceAliases(PythonReferenceAliasState()), set())
        broadness = PythonExceptionBroadness(containers.container_keys(), values)
        aliases = PythonExceptionAliasState(containers, broadness, values, multiplicity)
        rules = PythonExceptionRules(aliases, broadness, multiplicity, values)
        return PythonPrimaryExceptionBundle(aliases, rules)

    def type_state(self) -> PythonPrimaryTypeStateContract:
        """Responsibilities: _type state assembly_."""
        context = self._context
        factory_names: PythonTypeFactoryNamesContract = PythonTypeFactoryNames(
            context.aliases().containers.factory_container_aliases,
            PythonReferenceAliases(PythonReferenceAliasState()),
        )
        tuple_names: PythonTupleTypeNamesContract = PythonTupleTypeNames(
            context.aliases().containers.factory_container_aliases,
            PythonReferenceAliases(PythonReferenceAliasState()),
        )
        exceptions = self.exception_state()
        return PythonPrimaryTypeState(
            PythonPrimaryTypeStateOptions(
                factory_names,
                tuple_names,
                self._dynamic_rules(),
                exceptions.aliases,
                exceptions.rules,
            ),
        )

    def primary_rule_set(self) -> PythonPrimaryRuleSetContract:
        """Responsibilities: _primary rule composition_."""
        call_assembly = PythonPrimaryCallAssembly(self._context)
        call_state: PythonPrimaryCallBundleContract = call_assembly.call_state()
        type_state = self.type_state()
        return self._rule_set(call_state, type_state)
