from __future__ import annotations

import ast

from implementation.protocols import (
    PythonAssignedDescriptorIndexContract,
    PythonDecoratorNameContract,
)
from implementation.rules.constants import (
    PYTHON_CLASS_METHOD_DECORATOR,
    PYTHON_STATIC_METHOD_DECORATOR,
)


class PythonAssignedDescriptorIndex(PythonAssignedDescriptorIndexContract):
    """Responsibilities: _assigned descriptor indexing_, _descriptor kind lookup_."""

    def __init__(
        self,
        static_method_names: set[str],
        class_method_names: set[str],
        decorator_names: PythonDecoratorNameContract,
    ) -> None:
        """Responsibilities: _descriptor alias index setup_."""
        self.static_method_names: set[str] = static_method_names
        self.class_method_names: set[str] = class_method_names
        self.decorator_names: PythonDecoratorNameContract = decorator_names
        self.descriptor_kinds: dict[ast.AST, str] = {}

    def _assignment_targets(self, node: ast.AST) -> list[ast.AST]:
        """Responsibilities: _class descriptor targets_."""
        if type(node) is ast.Assign:
            return node.targets
        if type(node) is ast.AnnAssign:
            return [node.target]
        return []

    def _descriptor_kind(self, statement: ast.AST) -> str:
        """Responsibilities: _assigned descriptor kind_."""
        if type(statement) not in (ast.Assign, ast.AnnAssign):
            return ""
        value = statement.value
        if type(value) is not ast.Call:
            return ""
        name = self.decorator_names.expression_name(value.func)
        if name in self.static_method_names or name == PYTHON_STATIC_METHOD_DECORATOR:
            return "static"
        if name in self.class_method_names or name == PYTHON_CLASS_METHOD_DECORATOR:
            return "class"
        return ""

    def _index_class(self, node: ast.ClassDef) -> None:
        """Responsibilities: _class descriptor binding index_."""
        methods: dict[str, ast.AST] = {}
        for statement in node.body:
            if type(statement) in (ast.FunctionDef, ast.AsyncFunctionDef):
                methods[statement.name] = statement
                continue
            kind = self._descriptor_kind(statement)
            for target in self._assignment_targets(statement):
                if type(target) is not ast.Name:
                    continue
                method = methods.get(target.id)
                if method is None:
                    continue
                self.descriptor_kinds.pop(method, None)
                if kind:
                    self.descriptor_kinds[method] = kind

    def collect(self, tree: ast.AST) -> None:
        """Responsibilities: _module descriptor indexing_."""
        self.descriptor_kinds.clear()
        for node in ast.walk(tree):
            if type(node) is ast.ClassDef:
                self._index_class(node)

    def kind(self, node: ast.AST) -> str:
        """Responsibilities: _exact descriptor kind lookup_."""
        return self.descriptor_kinds.get(node, "")
