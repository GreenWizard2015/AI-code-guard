from dataclasses import dataclass

from implementation.ast.protocols import PythonAstNodeIndexContract
from implementation.protocols import (
    PythonTupleTypeNamesContract,
    PythonTypeFactoryNamesContract,
)
from implementation.references.protocols import PythonExceptionAliasStateContract
from implementation.rules.coding_issues.primary_rule_protocols import (
    PythonPrimaryRuleSetContract,
)
from implementation.rules.protocols import (
    PythonCallRulesContract,
    PythonConstructorRulesContract,
    PythonDecoratorAliasStateContract,
    PythonDecoratorRuleContract,
    PythonExceptionRulesContract,
    PythonTypeRulesContract,
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


@dataclass(frozen=True)
class PythonPrimaryRuleState:
    """Responsibilities: _primary rule state_, _type analysis_, _node lookup_."""

    rule_set: PythonPrimaryRuleSetContract
    type_rules: PythonTypeRulesContract
    node_index: PythonAstNodeIndexContract
