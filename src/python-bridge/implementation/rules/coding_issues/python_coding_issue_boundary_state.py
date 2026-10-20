from __future__ import annotations

from implementation.protocols import PythonProxyCallableAnalyzerContract
from implementation.rules.protocols import PythonFieldMutationCollectorContract
from implementation.rules.protocols import PythonUnnecessaryUndefinedCheckContract


class PythonCodingIssueBoundaryState:
    """Responsibilities: _field boundary analysis_, _proxy boundary analysis_."""

    _field_mutations: PythonFieldMutationCollectorContract
    _proxy_analyzer: PythonProxyCallableAnalyzerContract
    _unnecessary_undefined_check: PythonUnnecessaryUndefinedCheckContract

    def __init__(
        self,
        field_mutations: PythonFieldMutationCollectorContract,
        proxy_analyzer: PythonProxyCallableAnalyzerContract,
        unnecessary_undefined_check: PythonUnnecessaryUndefinedCheckContract,
    ) -> None:
        """Responsibilities: _boundary state initialization_."""
        self._field_mutations: PythonFieldMutationCollectorContract = field_mutations
        self._proxy_analyzer: PythonProxyCallableAnalyzerContract = proxy_analyzer
        self._unnecessary_undefined_check: PythonUnnecessaryUndefinedCheckContract = (
            unnecessary_undefined_check
        )

    def field_mutations(self) -> PythonFieldMutationCollectorContract:
        """Responsibilities: _field mutation access_."""
        return self._field_mutations

    def proxy_analyzer(self) -> PythonProxyCallableAnalyzerContract:
        """Responsibilities: _proxy analyzer access_."""
        return self._proxy_analyzer

    def unnecessary_undefined_check(self) -> PythonUnnecessaryUndefinedCheckContract:
        """Responsibilities: _undefined check access_."""
        return self._unnecessary_undefined_check
