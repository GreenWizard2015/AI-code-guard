from dataclasses import dataclass

from implementation.protocols import (
    PythonTupleTypeNamesContract,
    PythonTypeFactoryNamesContract,
)
from implementation.references.protocols import PythonExceptionAliasStateContract
from implementation.rules.protocols import (
    PythonCallRulesContract,
    PythonConstructorRulesContract,
    PythonDecoratorAliasStateContract,
    PythonDecoratorRuleContract,
    PythonExceptionRulesContract,
)
from implementation.rules.type_rule_protocols import PythonDynamicTypeRulesContract


@dataclass(frozen=True)
class PythonPrimaryRuleSet:
    """Responsibilities: _composed primary rule dependencies_."""

    call_rules: PythonCallRulesContract
    decorator_rules: PythonDecoratorRuleContract
    decorator_aliases: PythonDecoratorAliasStateContract
    constructor_rules: PythonConstructorRulesContract
    dynamic_type_rules: PythonDynamicTypeRulesContract
    exception_aliases: PythonExceptionAliasStateContract
    exception_rules: PythonExceptionRulesContract
    type_factory_names: PythonTypeFactoryNamesContract
    tuple_type_names: PythonTupleTypeNamesContract
