from __future__ import annotations

import ast
from collections.abc import Sequence

from implementation.ast.protocols import PythonAstNodeIndexContract
from implementation.references.decorator_protocols import (
    PythonAssignedDescriptorIndexContract,
    PythonDecoratorNameContract,
)
from implementation.rules.constants import (
    PYTHON_CLASS_METHOD_DECORATOR,
    PYTHON_STATIC_METHOD_DECORATOR,
)


class PythonAssignedDescriptorIndex(PythonAssignedDescriptorIndexContract):
    """Responsibilities: _assigned descriptor indexing_, _descriptor kind lookup_."""

    def _assignment_targets(self, node: ast.AST) -> Sequence[ast.AST]:
        """Responsibilities: _class descriptor targets_."""
        if type(node) is ast.Assign:
            return node.targets
        if type(node) is ast.AnnAssign:
            return [node.target]
        return []

    def _descriptor_kind(self, statement: ast.AST) -> str:
        """Responsibilities: _assigned descriptor kind_."""
        if type(statement) is ast.Assign:
            if type(statement.value) is not ast.Call:
                return ""
            return self._call_descriptor_kind(statement.value)
        if type(statement) is ast.AnnAssign:
            if statement.value is None:
                return ""
            if type(statement.value) is not ast.Call:
                return ""
            return self._call_descriptor_kind(statement.value)
        return ""

    def _call_descriptor_kind(self, call: ast.Call) -> str:
        """Responsibilities: _descriptor call kind_."""
        name = self._decorator_names.expression_name(call.func)
        if name in self._static_method_names or name == PYTHON_STATIC_METHOD_DECORATOR:
            return "static"
        if name in self._class_method_names or name == PYTHON_CLASS_METHOD_DECORATOR:
            return "class"
        return ""

    def _index_class(self, node: ast.ClassDef) -> None:
        """Responsibilities: _class descriptor binding index_."""
        methods: dict[str, ast.AST] = {}
        for statement in node.body:
            if type(statement) is ast.FunctionDef:
                methods[statement.name] = statement
                continue
            if type(statement) is ast.AsyncFunctionDef:
                methods[statement.name] = statement
                continue
            kind = self._descriptor_kind(statement)
            for target in self._assignment_targets(statement):
                if type(target) is not ast.Name:
                    continue
                if target.id not in methods:
                    continue
                method = methods[target.id]
                self._descriptor_kinds.pop(method, None)
                if kind:
                    self._descriptor_kinds.update({method: kind})

    def __init__(
        self,
        static_method_names: set[str],
        class_method_names: set[str],
        decorator_names: PythonDecoratorNameContract,
        node_index: PythonAstNodeIndexContract,
    ) -> None:
        """Responsibilities: _descriptor alias index setup_."""
        self._static_method_names: set[str] = static_method_names
        self._class_method_names: set[str] = class_method_names
        self._decorator_names: PythonDecoratorNameContract = decorator_names
        self._node_index: PythonAstNodeIndexContract = node_index
        self._descriptor_kinds: dict[ast.AST, str] = {}

    def collect(self, tree: ast.AST) -> None:
        """Responsibilities: _module descriptor indexing_."""
        self._descriptor_kinds.clear()
        for node in self._node_index.nodes(tree):
            if type(node) is ast.ClassDef:
                self._index_class(node)

    def kind(self, node: ast.AST) -> str:
        """Responsibilities: _exact descriptor kind lookup_."""
        return self._descriptor_kinds.get(node, "")
