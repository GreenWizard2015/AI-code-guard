from __future__ import annotations

import ast

from implementation.ast.protocols import PythonAstNodeIndexContract
from implementation.rules.constants import (
    PYTHON_INIT_METHOD,
    PYTHON_TEMPORAL_COUPLING_RULE_ID,
)
from implementation.rules.control_flow.python_temporal_access import (
    PythonTemporalAccess,
)
from implementation.rules.protocols import PythonMethodRecordContract, PythonTemporalFieldStateContract
from implementation.rules.types import PythonTemporalFieldState, PythonTemporalReaderIndex
from implementation.types import JsonObject

ClassMethodRecords = tuple[list[PythonMethodRecordContract], PythonTemporalFieldStateContract]


class PythonTemporalCoupling:
    """Responsibilities: _class field dependencies_, _temporal coupling_."""

    def _declared_fields(self, item: ast.AST) -> set[str]:
        """Responsibilities: _class-level field declarations_."""
        fields: set[str] = set()
        if type(item) is ast.Assign:
            fields.update(target.id for target in item.targets if type(target) is ast.Name)
        if type(item) is ast.AnnAssign and item.value is not None and type(item.target) is ast.Name:
            fields.add(item.target.id)
        return fields

    def _field_readers(
        self,
        methods: list[PythonMethodRecordContract],
    ) -> PythonTemporalReaderIndex:
        """Responsibilities: _field reader index_."""
        readers: PythonTemporalReaderIndex = {}
        for method in methods:
            for field in method.access_set():
                readers.setdefault(field, set()).add(method.syntax_node())
        return readers

    def _append_class_member(
        self,
        item: ast.stmt,
        methods: list[PythonMethodRecordContract],
        field_state: PythonTemporalFieldStateContract,
    ) -> None:
        """Responsibilities: _class member inventory_, _field initialization_."""
        match item:
            case ast.FunctionDef(name=name) | ast.AsyncFunctionDef(name=name):
                method = self._access.method_record(item, name)
                methods.append(method)
                if method.method_name() == PYTHON_INIT_METHOD:
                    field_state.initialized_fields.update(method.written_set())
            case _:
                field_state.initialized_fields.update(self._declared_fields(item))

    def _method_records(self, class_body: list[ast.stmt]) -> ClassMethodRecords:
        """Responsibilities: _method record collection_, _field initialization analysis_."""
        methods: list[PythonMethodRecordContract] = []
        field_state = PythonTemporalFieldState(initialized_fields=set(), readers={})
        for item in class_body:
            self._append_class_member(item, methods, field_state)
        return methods, field_state

    def _append_method_issues(
        self,
        method: PythonMethodRecordContract,
        field_state: PythonTemporalFieldStateContract,
        issues: list[JsonObject],
    ) -> None:
        """Responsibilities: _temporal coupling analysis_."""
        if method.method_name() == PYTHON_INIT_METHOD:
            return
        for field in method.written_set():
            if field in field_state.initialized_fields:
                continue
            if not any(reader is not method.syntax_node() for reader in field_state.readers.get(field, set())):
                continue
            issues.append(
                {
                    "line": method.syntax_node().lineno - 1,
                    "kind": PYTHON_TEMPORAL_COUPLING_RULE_ID,
                    "name": field,
                },
            )

    def __init__(self, node_index: PythonAstNodeIndexContract) -> None:
        """Responsibilities: _temporal analysis dependencies_."""
        self._access: PythonTemporalAccess = PythonTemporalAccess(node_index)
        self._node_index: PythonAstNodeIndexContract = node_index

    def class_issues(self, class_definition: ast.ClassDef) -> list[JsonObject]:
        """Responsibilities: _class temporal coupling_."""
        methods, field_state = self._method_records(class_definition.body)
        field_state.readers.update(self._field_readers(methods))
        issues: list[JsonObject] = []
        for method in methods:
            self._append_method_issues(method, field_state, issues)
        return issues

    def issues(self, tree: ast.Module) -> list[JsonObject]:
        """Responsibilities: _module temporal coupling_."""
        issues: list[JsonObject] = []
        for node in self._node_index.nodes(tree):
            if type(node) is ast.ClassDef:
                issues.extend(self.class_issues(node))
        return issues
