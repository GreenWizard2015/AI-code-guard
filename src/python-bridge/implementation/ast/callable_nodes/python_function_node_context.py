from __future__ import annotations

from dataclasses import dataclass

from implementation.ast.protocols import (
    PythonCallableArgumentsContract,
    PythonCallableMetricsContract,
    PythonCallableStatementsContract,
    PythonFunctionSelectorContract,
    PythonSourceSegmentsContract,
    PythonTestAssertionDataContract,
)


@dataclass(frozen=True)
class PythonFunctionNodeContext:
    """Responsibilities: _function metadata dependencies_."""

    source_segments: PythonSourceSegmentsContract
    function_selector: PythonFunctionSelectorContract
    test_assertion_data: PythonTestAssertionDataContract
    callable_arguments: PythonCallableArgumentsContract
    callable_metrics: PythonCallableMetricsContract
    callable_statements: PythonCallableStatementsContract
