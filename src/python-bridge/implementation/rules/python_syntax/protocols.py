from __future__ import annotations

import ast
from typing import TYPE_CHECKING, Protocol

if TYPE_CHECKING:
    from implementation.protocols import (
        PythonExceptionBroadnessContract,
        PythonExceptionMultiplicityContract,
        PythonTupleTypeNamesContract,
        PythonTypeFactoryNamesContract,
    )
    from implementation.references.protocols import (
        PythonContainerValuesContract,
        PythonExceptionAliasStateContract,
        PythonDynamicTypeReferencesContract,
        PythonContainerAliasesContract,
        PythonContainerAliasStateContract,
        PythonReferenceAliasesContract,
    )
    from implementation.rules.protocols import PythonExceptionRulesContract
    from implementation.rules.type_rule_protocols import PythonDynamicTypeRulesContract


class PythonDynamicImportReferenceContract(Protocol):
    """Responsibilities: _dynamic import reference contract_."""

    def kind_value(self) -> str: ...

    def name_value(self) -> str: ...

    def resolved(self) -> bool: ...


class PythonDynamicImportNamesContract(Protocol):
    """Responsibilities: _dynamic import names contract_."""

    def configure(self) -> None: ...

    def observe(self, node: ast.AST) -> None: ...

    def matches(self, function: ast.AST) -> bool: ...


class PythonDynamicImportNamesOptionsContract(Protocol):
    """Responsibilities: _import aliases_, _dynamic module names_."""

    @property
    def container_aliases(self) -> PythonContainerAliasesContract: ...

    @property
    def references(self) -> PythonDynamicImportReferenceResolverContract: ...

    @property
    def module_aliases(self) -> dict[str, str]: ...

    @property
    def builtin_module_aliases(self) -> set[str]: ...

    @property
    def function_aliases(self) -> dict[str, str]: ...


class PythonDynamicTypeRulesOptionsContract(Protocol):
    """Responsibilities: _dynamic type names_, _container and reference resolution_."""

    @property
    def type_names(self) -> set[str]: ...

    @property
    def module_names(self) -> set[str]: ...

    @property
    def references(self) -> PythonDynamicTypeReferencesContract: ...

    @property
    def container_aliases(self) -> PythonContainerAliasesContract: ...

    @property
    def container_state(self) -> PythonContainerAliasStateContract: ...

    @property
    def container_values(self) -> PythonContainerValuesContract: ...

    @property
    def assignment_aliases(self) -> PythonReferenceAliasesContract: ...


class PythonDynamicImportReferenceResolverContract(Protocol):
    """Responsibilities: _dynamic module reference_."""

    def reference(
        self,
        expression: ast.AST,
    ) -> PythonDynamicImportReferenceContract: ...


class PythonDynamicImportSubscriptOwnerContract(Protocol):
    """Responsibilities: _dynamic import subscript owner_."""

    @property
    def module(self) -> str: ...

    @property
    def name(self) -> str: ...


class PythonDynamicImportCallTargetContract(Protocol):
    """Responsibilities: _dynamic import target_."""

    @property
    def reference(self) -> PythonDynamicImportReferenceContract: ...

    @property
    def name(self) -> str: ...


class PythonExceptionHandlerAnalysisOptionsContract(Protocol):
    """Responsibilities: _exception handler inputs_, _exception policies_."""

    @property
    def handler(self) -> ast.ExceptHandler: ...

    @property
    def enclosing_statement(self) -> ast.AST: ...

    @property
    def aliases(self) -> PythonExceptionAliasStateContract: ...

    @property
    def broadness(self) -> PythonExceptionBroadnessContract: ...

    @property
    def multiplicity(self) -> PythonExceptionMultiplicityContract: ...

    @property
    def container_values(self) -> PythonContainerValuesContract: ...


class PythonPrimaryTypeStateOptionsContract(Protocol):
    """Responsibilities: _primary type names_, _type validation rules_."""

    @property
    def type_factory_names(self) -> PythonTypeFactoryNamesContract: ...

    @property
    def tuple_type_names(self) -> PythonTupleTypeNamesContract: ...

    @property
    def dynamic_rules(self) -> PythonDynamicTypeRulesContract: ...

    @property
    def exception_aliases(self) -> PythonExceptionAliasStateContract: ...

    @property
    def exception_rules(self) -> PythonExceptionRulesContract: ...


class PythonPrimaryExceptionBundleContract(Protocol):
    """Responsibilities: _exception alias state_, _exception rule state_."""

    def aliases(self) -> PythonExceptionAliasStateContract: ...

    def rules(self) -> PythonExceptionRulesContract: ...
