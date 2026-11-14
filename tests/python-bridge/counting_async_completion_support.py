from __future__ import annotations

from collections import Counter

from implementation.ast.protocols import PythonAstNodeIndexContract
from implementation.rules.call_analysis.testing.python_async_module_name_state import (
    PythonAsyncModuleNameState,
)
from implementation.rules.call_analysis.testing.python_unasserted_async_completion import (
    PythonUnassertedAsyncCompletion,
)


class CountingAsyncCompletion(PythonUnassertedAsyncCompletion, PythonAsyncModuleNameState):
    """Responsibilities: _async name instrumentation_, _completion result comparison_."""

    def __init__(
        self,
        node_index: PythonAstNodeIndexContract,
        snapshots: Counter[str],
    ) -> None:
        """Responsibilities: _async analysis instrumentation initialization_."""
        super().__init__(node_index)
        self._names: set[str] = set()
        self._snapshots: Counter[str] = snapshots
        self._module_names: PythonAsyncModuleNameState = self

    def snapshot(self) -> set[str]:
        """Responsibilities: _async module snapshot count_."""
        self._snapshots.update(count=1)
        return PythonAsyncModuleNameState.snapshot(self)
