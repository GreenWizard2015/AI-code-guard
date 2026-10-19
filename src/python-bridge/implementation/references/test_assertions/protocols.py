from __future__ import annotations

import ast
from typing import Protocol


class PythonTestAssertionAliasesContract(Protocol):
    """Responsibilities: _test assertion alias contract_."""

    def assertion_alias_present(self) -> bool: ...

    def assertion_call(self, node: ast.Call) -> bool: ...

    def exception_assertion(self, node: ast.Call) -> bool: ...
