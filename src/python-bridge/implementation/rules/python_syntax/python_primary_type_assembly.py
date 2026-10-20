from __future__ import annotations

from dataclasses import dataclass

from implementation.protocols import (
    PythonPrimaryTypeStateContract,
    PythonTypeFactoryNamesContract,
)
from implementation.references.aliases.python_reference_aliases import (
    PythonReferenceAliases,
)
from implementation.references.protocols import PythonExceptionAliasStateContract
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
)
from implementation.rules.python_syntax.python_dynamic_type_references import (
    PythonDynamicTypeReferences,
)
from implementation.rules.python_syntax.python_type_factory_names import (
    PythonTypeFactoryNames,
)
from implementation.rules.constants import PYTHON_BUILTINS_MODULE


@dataclass(frozen=True)
class PythonPrimaryExceptionBundle:
    """Responsibilities: _exception alias state_, _exception rule dependencies_."""

    aliases: PythonExceptionAliasStateContract
    rules: PythonExceptionRulesContract


class PythonPrimaryTypeAssembly:
    """Responsibilities: _dynamic type policy_, _exception policy_."""

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

    def __init__(self, context: PythonCodingIssueComponentContextContract) -> None:
        """Responsibilities: _type context ownership_."""
        self._context: PythonCodingIssueComponentContextContract = context

    def exception_state(self) -> PythonPrimaryExceptionBundle:
        """Responsibilities: _exception state assembly_."""
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

    def type_state(self) -> PythonPrimaryTypeStateContract:
        """Responsibilities: _type state assembly_."""
        context = self._context
        type_factory_names: PythonTypeFactoryNamesContract = PythonTypeFactoryNames(
            context.factory_container_aliases, PythonReferenceAliases()
        )
        exceptions = self.exception_state()
        return PythonPrimaryTypeState(
            type_factory_names,
            self._dynamic_rules(),
            exceptions.aliases,
            exceptions.rules,
        )
