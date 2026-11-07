from __future__ import annotations

import ast
from typing import TYPE_CHECKING, Protocol

if TYPE_CHECKING:
    from implementation.ast.protocols import PythonAstTreeStateContract
    from implementation.types import JsonObject


class PythonAstContentTreeViewContract(Protocol):
    """Responsibilities: _AST content analysis state_."""

    def tree(self) -> ast.Module: ...

    def class_nodes(self) -> list[JsonObject]: ...

    def analysis_state(self) -> PythonAstTreeStateContract: ...

    def coding_issues(self) -> list[JsonObject]: ...

    def timings_data(self) -> dict[str, float]: ...


class PythonAstContentCollectorContract(Protocol):
    """Responsibilities: _AST content collection_."""

    def structure(self) -> JsonObject: ...

    def collect(self) -> JsonObject: ...
