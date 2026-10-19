from __future__ import annotations

import ast

from implementation.protocols import PythonAstNodeIndexContract
from implementation.types import JsonObject
from implementation.rules.protocols import PythonMethodRecordContract
from implementation.rules.control_flow.python_method_record_value import (
    PythonMethodRecordValue,
)
from implementation.rules.constants import PYTHON_INIT_METHOD
from implementation.rules.constants import (
    PYTHON_FIELD_READ_EFFECT,
    PYTHON_FIELD_READ_EFFECTS,
    PYTHON_FIELD_READ_WRITE_EFFECTS,
    PYTHON_FIELD_WRITE_EFFECT,
    PYTHON_FIELD_WRITE_EFFECTS,
)
from implementation.rules.control_flow.types import FieldReaderIndex


class PythonTemporalCoupling:
    """Responsibilities: _field state_, _method dependencies_."""

    def _nested_callable(self, current: ast.AST, node: ast.AST) -> bool:
        """Responsibilities: _nested callable boundary_."""
        if current is node:
            return False
        return type(current) in (
            ast.FunctionDef,
            ast.AsyncFunctionDef,
            ast.Lambda,
            ast.ClassDef,
        )

    def _field_name(self, node: ast.AST) -> str:
        """Responsibilities: _self field naming_."""
        if type(node) is not ast.Attribute:
            return ""
        if type(node.value) is not ast.Name:
            return ""
        if node.value.id != "self":
            return ""
        return node.attr

    def _assignment_effects(
        self,
        node: ast.AST,
        parent: ast.Assign,
    ) -> frozenset[str]:
        """Responsibilities: _assignment field effects_."""
        if any(target is node for target in parent.targets):
            return PYTHON_FIELD_WRITE_EFFECTS
        return PYTHON_FIELD_READ_EFFECTS

    def _annotation_assignment_effects(
        self,
        node: ast.AST,
        parent: ast.AnnAssign,
    ) -> frozenset[str]:
        """Responsibilities: _annotated assignment field effects_."""
        if parent.target is node:
            return PYTHON_FIELD_WRITE_EFFECTS
        return PYTHON_FIELD_READ_EFFECTS

    def _field_access_effects(self, node: ast.AST) -> frozenset[str]:
        """Responsibilities: _field access effect classification_."""
        parents = self._node_index.parents(node)
        if len(parents) == 0:
            return PYTHON_FIELD_READ_EFFECTS
        parent = parents[0]
        if type(parent) is ast.Assign:
            return self._assignment_effects(node, parent)
        if type(parent) is ast.AnnAssign:
            return self._annotation_assignment_effects(node, parent)
        if type(parent) is ast.AugAssign and parent.target is node:
            return PYTHON_FIELD_READ_WRITE_EFFECTS
        return PYTHON_FIELD_READ_EFFECTS

    def _method_name(self, node: ast.AST) -> str:
        """Responsibilities: _method name state_."""
        if type(node) in (ast.FunctionDef, ast.AsyncFunctionDef):
            return node.name
        return ""

    def _collect_access_state(
        self,
        node: ast.AST,
    ) -> PythonMethodRecordContract:
        """Responsibilities: _method access state collection_."""
        writes: set[str] = set()
        reads: set[str] = set()

        def visit(current: ast.AST) -> None:
            """Responsibilities: _field access traversal_."""
            if self._nested_callable(current, node):
                return
            field = self._field_name(current)
            if field:
                effects = self._field_access_effects(current)
                if PYTHON_FIELD_WRITE_EFFECT in effects:
                    writes.add(field)
                if PYTHON_FIELD_READ_EFFECT in effects:
                    reads.add(field)
            for child in self._node_index.children(current):
                visit(child)

        visit(node)
        return PythonMethodRecordValue(self._method_name(node), node, writes, reads)

    def _class_methods(self, node: ast.ClassDef) -> list[PythonMethodRecordContract]:
        """Responsibilities: _class method record collection_."""
        methods: list[PythonMethodRecordContract] = []
        for item in node.body:
            if type(item) not in (ast.FunctionDef, ast.AsyncFunctionDef):
                continue
            state = self._collect_access_state(item)
            methods.append(state)
        return methods

    def _constructor_fields(self, item: ast.AST) -> set[str]:
        """Responsibilities: _constructor field state_."""
        if type(item) not in (ast.FunctionDef, ast.AsyncFunctionDef):
            return set()
        if item.name != PYTHON_INIT_METHOD:
            return set()
        return self._collect_access_state(item).written_set()

    def _declared_fields(self, item: ast.AST) -> set[str]:
        """Responsibilities: _class field declarations_."""
        fields: set[str] = set()
        if type(item) is ast.Assign:
            for target in item.targets:
                if type(target) is ast.Name:
                    fields.add(target.id)
        if type(item) is ast.AnnAssign:
            if type(item.target) is ast.Name:
                fields.add(item.target.id)
        return fields

    def _initialized_fields(self, node: ast.ClassDef) -> set[str]:
        """Responsibilities: _class constructor field state_."""
        initialized: set[str] = set()
        for item in node.body:
            initialized.update(self._constructor_fields(item))
            initialized.update(self._declared_fields(item))
        return initialized

    def _other_field_read(
        self,
        method: PythonMethodRecordContract,
        field: str,
        field_readers: FieldReaderIndex,
    ) -> bool:
        """Responsibilities: _cross-method field access_."""
        for reader_name in field_readers.get(field, set()):
            if reader_name != method.method_name():
                return True
        return False

    def _field_readers(
        self, methods: list[PythonMethodRecordContract]
    ) -> FieldReaderIndex:
        """Responsibilities: _field reader index construction_."""
        readers: FieldReaderIndex = {}
        for method in methods:
            for field in method.access_set():
                readers.setdefault(field, set()).add(method.method_name())
        return readers

    def _method_issues(
        self,
        method: PythonMethodRecordContract,
        initialized: set[str],
        field_readers: FieldReaderIndex,
    ) -> list[JsonObject]:
        """Responsibilities: _method temporal violations_."""
        if method.method_name() == PYTHON_INIT_METHOD:
            return []
        issues: list[JsonObject] = []
        for field in method.written_set():
            if field in initialized:
                continue
            if self._other_field_read(method, field, field_readers):
                issues.append(
                    {
                        "line": method.syntax_node().lineno - 1,
                        "kind": self._rule_id,
                        "name": field,
                    }
                )
        return issues

    def _class_issues(self, node: ast.ClassDef) -> list[JsonObject]:
        """Responsibilities: _class temporal violations_."""
        initialized = self._initialized_fields(node)
        methods = self._class_methods(node)
        field_readers = self._field_readers(methods)
        issues: list[JsonObject] = []
        for method in methods:
            issues.extend(self._method_issues(method, initialized, field_readers))
        return issues

    def __init__(self, node_index: PythonAstNodeIndexContract) -> None:
        """Responsibilities: _temporal coupling rule initialization_."""
        self._rule_id: str = "temporal-coupling"
        self._node_index: PythonAstNodeIndexContract = node_index

    def issues(self, tree: ast.Module) -> list[JsonObject]:
        """Responsibilities: _temporal field coupling_."""
        issues: list[JsonObject] = []
        for node in self._node_index.nodes(tree):
            if type(node) is ast.ClassDef:
                issues.extend(self._class_issues(node))
        return issues

    def classes(self, tree: ast.Module) -> list[ast.ClassDef]:
        """Responsibilities: _temporal coupling class selection_."""
        return [
            node for node in self._node_index.nodes(tree) if type(node) is ast.ClassDef
        ]
