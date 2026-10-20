from __future__ import annotations

import ast
from pathlib import Path
from typing import TYPE_CHECKING, Protocol

if TYPE_CHECKING:
    from implementation.references.protocols import PythonContainerAliasesContract
    from implementation.types import JsonObject


class PythonModuleInstanceCollectorContract(Protocol):
    """Responsibilities: _module instance collection contract_."""

    def collect(self) -> list[JsonObject]: ...


class PythonAstContentTreeContract(Protocol):
    """Responsibilities: _AST content collection boundary_."""

    def container_aliases(self) -> PythonContainerAliasesContract: ...

    def timings_data(self) -> dict[str, float]: ...


class PythonReferenceCollectorContract(Protocol):
    """Responsibilities: _Python reference collection_."""

    def collect_references(self) -> list[JsonObject]: ...

    def timings_data(self) -> dict[str, float]: ...


class PythonAstContentContract(Protocol):
    """Responsibilities: _Python AST content collection_."""

    def collect(self) -> JsonObject: ...


class PythonAstTimedResultContract(Protocol):
    """Responsibilities: _AST timing values_."""

    def ast_data(self) -> JsonObject: ...

    def syntax_duration(self) -> float: ...

    def normalization_duration(self) -> float: ...

    def stage_times(self) -> dict[str, float]: ...


class PythonAstBridgeContract(Protocol):
    """Responsibilities: _Python bridge operations_."""

    def source_ast(self, text: str) -> JsonObject: ...

    def source_ast_timed(self, text: str) -> PythonAstTimedResultContract: ...


class PythonImportNodesContract(Protocol):
    """Responsibilities: _Python import record collection_."""

    def import_records(self) -> list[JsonObject]: ...


class PythonBridgeInputContract(Protocol):
    """Responsibilities: _bridge input source resolution_."""

    def resolve(self, source: str) -> str: ...


class PythonBridgeFileIOContract(Protocol):
    """Responsibilities: _bridge file membership_, _source content retrieval_."""

    def file_present(self, path: Path) -> bool: ...

    def source_content(self, path: Path) -> str: ...


class PythonSysPathAliasesContract(Protocol):
    """Responsibilities: _sys path alias contract_."""

    def path_mutating(self, name: str) -> bool: ...

    def path_mutator_name(self, name: str) -> bool: ...


class PythonSysPathReferencesContract(Protocol):
    """Responsibilities: _sys path references contract_."""

    def path_alias_assignment(self, node: ast.AST) -> bool: ...

    def path_call(self, node: ast.Call) -> bool: ...


class PythonSysPathRulesContract(Protocol):
    """Responsibilities: _sys path rules contract_."""

    def configure(self, tree: ast.Module) -> None: ...

    def path_mutation(self, node: ast.AST) -> bool: ...


class PythonImportRulesContract(Protocol):
    """Responsibilities: _Python import diagnostics contract_."""

    def import_issues(self, tree: ast.Module) -> list[JsonObject]: ...
