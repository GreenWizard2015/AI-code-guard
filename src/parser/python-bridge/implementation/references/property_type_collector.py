from __future__ import annotations


from typing import Any, cast
from implementation.ast.protocols import PythonAstNodeIndexProtocol
from implementation.references.property_type_resolver import PythonPropertyType
import ast


class PythonPropertyTypeCollector:
    """Responsibilities: _collection property types annotations_."""

    def _append_property_method(
        self,
        node: ast.AST,
        owner: str,
    ) -> None:
        """Responsibilities: _output type property recording_."""
        decorators: Any = {self._decorator_name(item) for item in node.decorator_list}
        if not decorators.intersection({"property", "cached_property"}):
            return
        type_name: Any = self.type_resolver.annotation_type(node.returns)
        if type_name:
            self._properties[f"{owner}.{node.name}"] = type_name

    def _append_annotation_property(self, node: ast.AnnAssign, owner: str) -> None:
        """Responsibilities: _annotated declared type recording_."""
        if type(node.target) is not ast.Name:
            return
        type_name: Any = self.type_resolver.annotation_type(node.annotation)
        if type_name:
            self._properties[f"{owner}.{node.target.id}"] = type_name

    def _append_init_properties(
        self,
        node: ast.AST,
        owner: str,
    ) -> None:
        """Responsibilities: _initializer typed instance scanning_."""
        arguments: Any = self.type_resolver.init_arguments(node)
        for item in self.node_index.nodes(node):
            self._append_init_assignment(item, owner, arguments)

    def _append_init_assignment(
        self,
        item: ast.AST,
        owner: str,
        arguments: dict[str, str],
    ) -> None:
        """Responsibilities: _typed instance assignment recording_."""
        target: Any = self.type_resolver.assignment_target(item)
        if not self.type_resolver.instance_target(target):
            return
        type_name: Any = self.type_resolver.assignment_type(item, arguments)
        if type_name:
            attribute: Any = cast(ast.Attribute, target)
            self._properties[f"{owner}.{attribute.attr}"] = type_name

    def _decorator_name(self, node: ast.expr) -> str:
        """Responsibilities: _normalization decorator invocation name_."""
        value: Any = node
        if type(node) is ast.Call:
            value: Any = node.func
        if type(value) is ast.Name:
            return value.id
        if type(value) is ast.Attribute:
            return value.attr
        return ""

    def _class_items(self, item: ast.stmt) -> list[ast.stmt]:
        """Responsibilities: _unwrap TYPE CHECKING blocks_."""
        if type(item) is not ast.If:
            return [item]
        condition: Any = item.test
        is_type_checking = type(condition) is ast.Name
        if is_type_checking and condition.id == "TYPE_CHECKING":
            return item.body
        return [item]

    def _append_class_item(self, item: ast.stmt, owner: str) -> None:
        """Responsibilities: _collection property metadata class_."""
        if type(item) in (ast.FunctionDef, ast.AsyncFunctionDef):
            self._append_property_method(
                cast(ast.AST, item),
                owner,
            )
            return
        if type(item) is ast.AnnAssign:
            self._append_annotation_property(item, owner)

    def _collect_class_members(self, node: ast.ClassDef) -> None:
        """Responsibilities: _class members annotated scanning_."""
        for item in node.body:
            for nested in self._class_items(item):
                self._append_class_item(nested, node.name)

    def _initializer(self, node: ast.ClassDef) -> list[ast.AST]:
        """Responsibilities: _class initializer instance-property lookup_."""
        for item in node.body:
            if type(item) not in (ast.FunctionDef, ast.AsyncFunctionDef):
                continue
            callable_node: Any = cast(ast.AST, item)
            if callable_node.name == "__init__":
                return [callable_node]
        return []

    def __init__(
        self,
        tree: ast.Module,
        type_resolver: PythonPropertyType,
        node_index: PythonAstNodeIndexProtocol,
    ) -> None:
        """Responsibilities: _initialization source tree type_."""
        self.tree: Any = tree
        self.node_index: Any = node_index
        self.type_resolver: Any = type_resolver
        self._properties: dict[str, str] = {}

    def collect_properties(self) -> dict[str, str]:
        """Responsibilities: _collection property types every_."""
        self._properties.clear()
        for node in self.node_index.nodes(self.tree):
            if type(node) is ast.ClassDef:
                self.collect_class_properties(node)
        return dict(self._properties)

    def collect_class_properties(self, node: ast.ClassDef) -> None:
        """Responsibilities: _collection declared initialization properties_."""
        self._collect_class_members(node)
        initializers: Any = self._initializer(node)
        if initializers:
            self._append_init_properties(initializers[0], node.name)
