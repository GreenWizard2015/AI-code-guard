from __future__ import annotations


from typing import Any, Optional
import ast

from implementation.ast.annotation_resolver import AnnotationNames


class PythonPropertyType:
    """Responsibilities: _resolution Python property annotations_."""

    def _assignment_parts(self, node: ast.AST) -> dict[str, Optional[ast.AST]]:
        """Responsibilities: _normalization target annotation value_."""
        if type(node) is ast.AnnAssign:
            return {"annotation": node.annotation, "value": node.value}
        if type(node) is ast.Assign:
            return {"annotation": None, "value": node.value}
        return {"annotation": None, "value": None}

    def _is_self_name(self, target: ast.AST) -> bool:
        """Responsibilities: _classification target self attribute_."""
        if type(target) is not ast.Name:
            return False
        return target.id == "self"

    def __init__(
        self,
        aliases: dict[str, str],
        class_names: set[str],
        annotation_resolver: AnnotationNames,
    ) -> None:
        """Responsibilities: _initialization aliases known classes_."""
        self.aliases: Any = aliases
        self.class_names: Any = class_names
        self.annotation_resolver: Any = annotation_resolver

    def annotation_type(self, annotation: ast.AST) -> str:
        """Responsibilities: _resolution normalization type name_."""
        type_name: Any = self.annotation_resolver.annotation_name(
            annotation, self.aliases, {"Optional", "Union"}
        )
        if not type_name:
            return ""
        return type_name

    def init_arguments(self, node: ast.AST) -> dict[str, str]:
        """Responsibilities: _index constructor parameter annotations_."""
        arguments: Any = [*node.args.args, *node.args.kwonlyargs]
        result: dict[str, str] = {}
        for argument in arguments:
            type_name: Any = self.annotation_type(argument.annotation)
            if type_name:
                result[argument.arg] = type_name
        return result

    def assignment_type(
        self,
        node: ast.AST,
        arguments: dict[str, str],
    ) -> str:
        """Responsibilities: _resolution type represented assignment_."""
        parts: Any = self._assignment_parts(node)
        annotation: Any = parts["annotation"]
        value: Any = parts["value"]
        type_name: Any = self.annotation_type(annotation)
        if not type_name and type(value) is ast.Name:
            type_name: Any = arguments.get(value.id, "")
        if type_name:
            return type_name
        return self.annotation_resolver.constructor_name(
            value, self.class_names, self.aliases
        )

    def assignment_target(self, node: ast.AST) -> ast.AST:
        """Responsibilities: _extraction target supported assignment_."""
        if type(node) is ast.Assign:
            if len(node.targets) != 1:
                return ast.Constant(value=None)
            return node.targets[0]
        if type(node) is ast.AnnAssign:
            return node.target
        return ast.Constant(value=None)

    def instance_target(self, target: ast.AST) -> bool:
        """Responsibilities: _classification target assigns instance_."""
        if type(target) is not ast.Attribute:
            return False
        return self._is_self_name(target.value)
