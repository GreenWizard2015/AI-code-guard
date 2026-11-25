from __future__ import annotations

import ast
from dataclasses import dataclass

from implementation.protocols import (
    PythonExceptionBroadnessContract,
    PythonExceptionMultiplicityContract,
    PythonTupleTypeNamesContract,
    PythonTypeFactoryNamesContract,
)
from implementation.references.protocols import (
    PythonContainerValuesContract,
    PythonExceptionAliasStateContract,
)
from implementation.rules.protocols import (
    PythonDynamicTypeRulesContract,
    PythonExceptionRulesContract,
)


@dataclass(frozen=True)
class PythonExceptionHandlerAnalysisOptions:
    """Responsibilities: _exception handler analysis inputs_."""

    handler: ast.ExceptHandler
    enclosing_statement: ast.AST
    aliases: PythonExceptionAliasStateContract
    broadness: PythonExceptionBroadnessContract
    multiplicity: PythonExceptionMultiplicityContract
    container_values: PythonContainerValuesContract


@dataclass(frozen=True)
class PythonPrimaryTypeStateOptions:
    """Responsibilities: _primary type analyzer dependencies_."""

    type_factory_names: PythonTypeFactoryNamesContract
    tuple_type_names: PythonTupleTypeNamesContract
    dynamic_rules: PythonDynamicTypeRulesContract
    exception_aliases: PythonExceptionAliasStateContract
    exception_rules: PythonExceptionRulesContract
