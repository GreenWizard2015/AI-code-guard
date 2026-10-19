from __future__ import annotations

from dataclasses import dataclass

from implementation.protocols import (
    PythonCallRulesContract,
    PythonCodingIssueComponentContextContract,
    PythonDecoratorAliasesContract,
    PythonDecoratorRulesContract,
    PythonDynamicTypeRulesContract,
    PythonExceptionAliasStateContract,
    PythonExceptionRulesContract,
    PythonPrimaryTypeStateContract,
    PythonTypeFactoryNamesContract,
)
from implementation.references.aliases.python_reference_aliases import (
    PythonReferenceAliases,
)
from implementation.rules.call_analysis.call_rules import CallRules, CallRulesOptions
from implementation.rules.call_analysis.python_call_alias_state import (
    PythonCallAliasState,
)
from implementation.rules.call_analysis.python_call_classification import (
    PythonCallClassification,
)
from implementation.rules.constants import PYTHON_BUILTINS_MODULE
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
)
from implementation.rules.python_syntax.decorators.python_decorator_alias_state import (
    PythonDecoratorAliasState,
)
from implementation.rules.python_syntax.decorators.python_decorator_rules import (
    PythonDecoratorRules,
)
from implementation.rules.python_syntax.python_dynamic_type_references import (
    PythonDynamicTypeReferences,
)
from implementation.rules.python_syntax.python_type_factory_names import (
    PythonTypeFactoryNames,
)


@dataclass(frozen=True)
class PythonPrimaryCallBundle:
    """Responsibilities: _invocation rules_, _decorator rules_."""

    call_rules: PythonCallRulesContract
    decorator_rules: PythonDecoratorRulesContract
    decorator_aliases: PythonDecoratorAliasesContract


@dataclass(frozen=True)
class PythonPrimaryExceptionBundle:
    """Responsibilities: _exception alias state_, _exception rule dependencies_."""

    aliases: PythonExceptionAliasStateContract
    rules: PythonExceptionRulesContract


class PythonPrimaryRuleAssembly:
    """Responsibilities: _rule composition_, _type rules_."""

    _context: PythonCodingIssueComponentContextContract

    def _dynamic_rules(self) -> PythonDynamicTypeRulesContract:
        """Responsibilities: _dynamic type dependencies_."""
        context = self._context
        type_names: set[str] = {"type"}
        module_names: set[str] = {PYTHON_BUILTINS_MODULE}
        references = PythonDynamicTypeReferences(
            type_names,
            module_names,
            context.dynamic_container_aliases,
            context.dynamic_container_aliases.container_values,
        )
        return PythonDynamicTypeRules(
            PythonDynamicTypeRulesOptions(
                type_names,
                module_names,
                references,
                context.dynamic_container_aliases,
                context.dynamic_container_aliases.container_values,
                PythonReferenceAliases(),
            )
        )

    def _exception_state(self) -> PythonPrimaryExceptionBundle:
        """Responsibilities: _exception dependencies_."""
        context = self._context
        values = context.exception_container_aliases.container_values
        multiplicity = PythonExceptionMultiplicity(
            values, PythonReferenceAliases(), set()
        )
        broadness = PythonExceptionBroadness(values.keys, values)
        aliases: PythonExceptionAliasStateContract = PythonExceptionAliasState(
            context.exception_container_aliases, broadness, values, multiplicity
        )
        rules: PythonExceptionRulesContract = PythonExceptionRules(
            aliases, broadness, multiplicity
        )
        return PythonPrimaryExceptionBundle(aliases, rules)

    def __init__(self, context: PythonCodingIssueComponentContextContract) -> None:
        """Responsibilities: _primary dependency initialization_."""
        self._context: PythonCodingIssueComponentContextContract = context

    def call_state(self) -> PythonPrimaryCallBundle:
        """Responsibilities: _invocation dependencies_."""
        context = self._context
        aliases = PythonCallAliasState()
        classification = PythonCallClassification(context.reference_aliases, aliases)
        call_rules: PythonCallRulesContract = CallRules(
            CallRulesOptions(
                context.tree,
                context.node_index,
                aliases,
                context.reference_aliases,
                classification,
            )
        )
        decorator_aliases = PythonDecoratorAliasState(
            context.decorator_container_aliases, PythonReferenceAliases()
        )
        decorator_rules: PythonDecoratorRulesContract = PythonDecoratorRules(
            context.decorator_container_aliases,
            PythonReferenceAliases(),
            decorator_aliases,
            decorator_aliases.assigned_descriptors,
        )
        return PythonPrimaryCallBundle(call_rules, decorator_rules, decorator_aliases)

    def type_state(self) -> PythonPrimaryTypeStateContract:
        """Responsibilities: _type state assembly_."""
        context = self._context
        type_factory_names: PythonTypeFactoryNamesContract = PythonTypeFactoryNames(
            context.factory_container_aliases, PythonReferenceAliases()
        )
        exceptions = self._exception_state()
        return PythonPrimaryTypeState(
            type_factory_names,
            self._dynamic_rules(),
            exceptions.aliases,
            exceptions.rules,
        )
