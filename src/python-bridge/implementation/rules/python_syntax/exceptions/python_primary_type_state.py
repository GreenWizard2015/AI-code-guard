from __future__ import annotations

from implementation.protocols import (
    PythonDynamicTypeRulesContract,
    PythonExceptionAliasStateContract,
    PythonExceptionRulesContract,
    PythonTypeFactoryNamesContract,
)


class PythonPrimaryTypeState:
    """Responsibilities: _type analysis_, _exception analysis_."""

    _type_factory_names: PythonTypeFactoryNamesContract
    _dynamic_rules: PythonDynamicTypeRulesContract
    _exception_aliases: PythonExceptionAliasStateContract
    _exception_rules: PythonExceptionRulesContract

    def __init__(
        self,
        type_factory_names: PythonTypeFactoryNamesContract,
        dynamic_rules: PythonDynamicTypeRulesContract,
        exception_aliases: PythonExceptionAliasStateContract,
        exception_rules: PythonExceptionRulesContract,
    ) -> None:
        """Responsibilities: _type state initialization_."""
        self._type_factory_names: PythonTypeFactoryNamesContract = type_factory_names
        self._dynamic_rules: PythonDynamicTypeRulesContract = dynamic_rules
        self._exception_aliases: PythonExceptionAliasStateContract = exception_aliases
        self._exception_rules: PythonExceptionRulesContract = exception_rules

    def type_factory_names(self) -> PythonTypeFactoryNamesContract:
        """Responsibilities: _type factory name access_."""
        return self._type_factory_names

    def dynamic_rules(self) -> PythonDynamicTypeRulesContract:
        """Responsibilities: _dynamic type rule access_."""
        return self._dynamic_rules

    def exception_aliases(self) -> PythonExceptionAliasStateContract:
        """Responsibilities: _exception alias access_."""
        return self._exception_aliases

    def exception_rules(self) -> PythonExceptionRulesContract:
        """Responsibilities: _exception rule access_."""
        return self._exception_rules
