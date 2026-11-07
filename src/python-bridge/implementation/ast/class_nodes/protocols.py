from __future__ import annotations

import ast
from typing import Protocol

from implementation.types import JsonObject


class PythonClassNodeFieldsContract(Protocol):
    """Responsibilities: _Python class field collection_."""

    def untyped_field_records(self) -> PythonUntypedClassFieldsContract: ...

    def fields(self) -> list[JsonObject]: ...


class PythonClassNodeDetailsContract(Protocol):
    """Responsibilities: _Python class metadata details_."""

    def metadata(self, method_nodes: list[JsonObject]) -> JsonObject: ...

    def dependencies(self) -> list[str]: ...


class PythonInstanceFieldRecordsContract(Protocol):
    """Responsibilities: _method instance field collection_."""

    def for_method(self, method: ast.stmt) -> list[JsonObject]: ...

    def for_class(self, methods: list[ast.stmt]) -> list[JsonObject]: ...


class PythonUntypedClassFieldsContract(Protocol):
    """Responsibilities: _untyped class field collection_."""

    def collect(self, typed_fields: list[JsonObject]) -> list[JsonObject]: ...

    def method_fields(self, candidate: ast.stmt) -> list[JsonObject]: ...


class PythonClassFieldRecordContract(Protocol):
    """Responsibilities: _class field record operations_."""

    def visibility(self, name: str) -> str: ...

    def field_name(self, field: JsonObject) -> str: ...

    def annotated_field(
        self,
        item: ast.AnnAssign,
        field_name: str,
        class_scope: bool = True,
    ) -> JsonObject: ...

    def instance_field(
        self,
        line: int,
        value: ast.expr,
        field_name: str,
    ) -> JsonObject: ...

    def assigned_fields(self, item: ast.Assign) -> list[JsonObject]: ...


class PythonInstanceFieldNamesContract(Protocol):
    """Responsibilities: _instance field name classification_."""

    def instance_target(self, target: ast.AST) -> bool: ...

    def names(self) -> set[str]: ...


class PythonSlotFieldsContract(Protocol):
    """Responsibilities: _slot field collection_."""

    def fields(self) -> dict[str, int]: ...

    def untyped_fields(self, typed_names: set[str]) -> list[JsonObject]: ...
