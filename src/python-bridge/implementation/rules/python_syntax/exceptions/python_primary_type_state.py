from __future__ import annotations

from dataclasses import dataclass

from implementation.protocols import (
    PythonTupleTypeNamesContract,
    PythonTypeFactoryNamesContract,
)
from implementation.references.protocols import PythonExceptionAliasStateContract
from implementation.rules.protocols import (
    PythonDynamicTypeRulesContract,
    PythonExceptionRulesContract,
)


@dataclass(frozen=True)
class PythonPrimaryTypeStateOptions:
    """Responsibilities: _primary type analyzer dependencies_."""

    type_factory_names: PythonTypeFactoryNamesContract
    tuple_type_names: PythonTupleTypeNamesContract
    dynamic_rules: PythonDynamicTypeRulesContract
    exception_aliases: PythonExceptionAliasStateContract
    exception_rules: PythonExceptionRulesContract


class PythonPrimaryTypeState:
    """Responsibilities: _type analysis_, _exception analysis_."""

    def __init__(self, options: PythonPrimaryTypeStateOptions) -> None:
        """Responsibilities: _type state initialization_."""
        self._type_factory_names: PythonTypeFactoryNamesContract = options.type_factory_names
        self._tuple_type_names: PythonTupleTypeNamesContract = options.tuple_type_names
        self._dynamic_rules: PythonDynamicTypeRulesContract = options.dynamic_rules
        self._exception_aliases: PythonExceptionAliasStateContract = options.exception_aliases
        self._exception_rules: PythonExceptionRulesContract = options.exception_rules

    def type_factory_names(self) -> PythonTypeFactoryNamesContract:
        """Responsibilities: _type factory name access_."""
        return self._type_factory_names

    def tuple_type_names(self) -> PythonTupleTypeNamesContract:
        """Responsibilities: _tuple type name access_."""
        return self._tuple_type_names

    def dynamic_rules(self) -> PythonDynamicTypeRulesContract:
        """Responsibilities: _dynamic type rule access_."""
        return self._dynamic_rules

    def exception_aliases(self) -> PythonExceptionAliasStateContract:
        """Responsibilities: _exception alias access_."""
        return self._exception_aliases

    def exception_rules(self) -> PythonExceptionRulesContract:
        """Responsibilities: _exception rule access_."""
        return self._exception_rules
