from __future__ import annotations

import ast

from implementation.references.instances.python_assignment_effects import (
    PythonAssignmentEffects,
)
from implementation.references.protocols import (
    PythonAnnotationResolverContract,
)
from implementation.rules.constants import PYTHON_OPTIONAL_NAME, PYTHON_UNION_NAME
from implementation.rules.protocols import PythonAssignmentEffectsContract


class PythonPropertyType:
    """Responsibilities: _annotation type resolution_, _assignment target inference_."""

    def _is_self_name(self, target: ast.AST) -> bool:
        """Responsibilities: _classification target self attribute_."""
        if type(target) is not ast.Name:
            return False
        return target.id == "self"

    def _runtime_assignment_type(
        self,
        effects: PythonAssignmentEffectsContract,
        arguments: dict[str, str],
    ) -> str:
        """Responsibilities: _runtime assignment type resolution_."""
        assigned_value = effects.assigned_value()
        if type(assigned_value) is ast.Name:
            argument_type = arguments.get(assigned_value.id, "")
            if argument_type:
                return argument_type
        if not effects.runtime_value_present():
            return ""
        return self._annotation_resolver.resolve_constructor(
            assigned_value,
            self._class_names,
            self._aliases,
        )

    def __init__(
        self,
        aliases: dict[str, str],
        class_names: set[str],
        annotation_resolver: PythonAnnotationResolverContract,
    ) -> None:
        """Responsibilities: _initialization aliases known classes_."""
        self._aliases: dict[str, str] = aliases
        self._class_names: set[str] = class_names
        self._annotation_resolver: PythonAnnotationResolverContract = annotation_resolver

    def annotation_type(self, annotation: ast.expr) -> str:
        """Responsibilities: _resolution normalization type name_."""
        type_name = self._annotation_resolver.annotation_name(
            annotation,
            self._aliases,
            {PYTHON_OPTIONAL_NAME, PYTHON_UNION_NAME},
        )
        if not type_name:
            return ""
        return type_name

    def init_arguments(self, node: ast.AST) -> dict[str, str]:
        """Responsibilities: _index constructor parameter annotations_."""
        if type(node) is ast.FunctionDef:
            function_arguments = node.args
        else:
            if type(node) is not ast.AsyncFunctionDef:
                return {}
            function_arguments = node.args
        arguments = [*function_arguments.args, *function_arguments.kwonlyargs]
        result: dict[str, str] = {}
        for argument in arguments:
            if argument.annotation is None:
                continue
            type_name = self.annotation_type(argument.annotation)
            if type_name:
                result[argument.arg] = type_name
        return result

    def assignment_type(self, node: ast.AST, arguments: dict[str, str]) -> str:
        """Responsibilities: _assignment type resolution_."""
        effects = PythonAssignmentEffects(node)
        if effects.annotation_present():
            return self.annotation_type(effects.declared_annotation())
        return self._runtime_assignment_type(effects, arguments)

    def instance_target(self, target: ast.AST) -> bool:
        """Responsibilities: _classification target assigns instance_."""
        if type(target) is not ast.Attribute:
            return False
        return self._is_self_name(target.value)
