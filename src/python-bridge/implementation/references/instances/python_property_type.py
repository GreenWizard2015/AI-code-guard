from __future__ import annotations

import ast
from typing import Any

from implementation.ast.type_declarations.annotation_names import AnnotationNames
from implementation.references.instances.python_assignment_effects import (
    PythonAssignmentEffects,
)
from implementation.references.protocols import PythonAnnotationResolverContract
from implementation.protocols import PythonAssignmentEffectsContract
from implementation.rules.constants import PYTHON_OPTIONAL_NAME, PYTHON_UNION_NAME


class PythonPropertyType:
    """Responsibilities: _annotation type resolution_, _assignment target inference_."""

    def _is_self_name(self, target: ast.AST) -> bool:
        """Responsibilities: _classification target self attribute_."""
        if type(target) is not ast.Name:
            return False
        return target.id == "self"

    def _annotation_assignment_type(
        self, effects: PythonAssignmentEffectsContract
    ) -> str:
        """Responsibilities: _assignment annotation type_."""
        if not effects.annotation_present():
            return ""
        return self.annotation_type(effects.declared_annotation())

    def _argument_assignment_type(
        self,
        effects: PythonAssignmentEffectsContract,
        arguments: dict[str, str],
    ) -> str:
        """Responsibilities: _assignment argument type_."""
        if type(effects.assigned_value()) is not ast.Name:
            return ""
        return arguments.get(effects.assigned_value().id, "")

    def _runtime_assignment_type(self, effects: PythonAssignmentEffectsContract) -> str:
        """Responsibilities: _runtime constructor assignment type_."""
        if not effects.runtime_value_present():
            return ""
        return AnnotationNames.resolve_constructor(
            self.annotation_resolver,
            effects.assigned_value(),
            self.class_names,
            self.aliases,
        )

    def __init__(
        self,
        aliases: dict[str, str],
        class_names: set[str],
        annotation_resolver: PythonAnnotationResolverContract,
    ) -> None:
        """Responsibilities: _initialization aliases known classes_."""
        self.aliases: Any = aliases
        self.class_names: Any = class_names
        self.annotation_resolver: PythonAnnotationResolverContract = annotation_resolver

    def annotation_type(self, annotation: ast.AST) -> str:
        """Responsibilities: _resolution normalization type name_."""
        type_name: Any = self.annotation_resolver.annotation_name(
            annotation, self.aliases, {PYTHON_OPTIONAL_NAME, PYTHON_UNION_NAME}
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

    def assignment_type(self, node: ast.AST, arguments: dict[str, str]) -> str:
        """Responsibilities: _resolution type represented assignment_."""
        effects = PythonAssignmentEffects(node)
        type_name: Any = self._annotation_assignment_type(effects)
        if type_name:
            return type_name
        type_name = self._argument_assignment_type(effects, arguments)
        if type_name:
            return type_name
        return self._runtime_assignment_type(effects)

    def instance_target(self, target: ast.AST) -> bool:
        """Responsibilities: _classification target assigns instance_."""
        if type(target) is not ast.Attribute:
            return False
        return self._is_self_name(target.value)
