from __future__ import annotations

from dataclasses import dataclass

from implementation.references.protocols import (
    PythonContainerAliasesContract,
    PythonContainerAliasStateContract,
    PythonContainerValuesContract,
    PythonDynamicTypeReferencesContract,
    PythonReferenceAliasesContract,
)
from implementation.rules.protocols import (
    PythonCallRulesContract,
    PythonDecoratorAliasStateContract,
    PythonDecoratorRuleContract,
)
from implementation.rules.python_syntax.protocols import (
    PythonDynamicImportReferenceContract,
    PythonDynamicImportReferenceResolverContract,
)


@dataclass(frozen=True)
class PythonDynamicImportNamesOptions:
    """Responsibilities: _import aliases_, _dynamic module names_."""

    container_aliases: PythonContainerAliasesContract
    references: PythonDynamicImportReferenceResolverContract
    module_aliases: dict[str, str]
    builtin_module_aliases: set[str]
    function_aliases: dict[str, str]


@dataclass
class PythonDynamicTypeRulesOptions:
    """Responsibilities: _dynamic type names_, _container and reference resolution_."""

    type_names: set[str]
    module_names: set[str]
    references: PythonDynamicTypeReferencesContract
    container_aliases: PythonContainerAliasesContract
    container_state: PythonContainerAliasStateContract
    container_values: PythonContainerValuesContract
    assignment_aliases: PythonReferenceAliasesContract


@dataclass(frozen=True)
class PythonDynamicImportSubscriptOwner:
    """Responsibilities: _dynamic import subscript owner_."""

    module: str
    name: str


@dataclass(frozen=True)
class PythonDynamicImportCallTarget:
    """Responsibilities: _dynamic import target_."""

    reference: PythonDynamicImportReferenceContract
    name: str


@dataclass(frozen=True)
class PythonPrimaryCallBundle:
    """Responsibilities: _invocation policy_, _decorator policy_."""

    call_rules: PythonCallRulesContract
    decorator_rules: PythonDecoratorRuleContract
    decorator_aliases: PythonDecoratorAliasStateContract
