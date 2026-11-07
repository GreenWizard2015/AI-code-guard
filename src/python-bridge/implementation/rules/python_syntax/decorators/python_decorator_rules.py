from __future__ import annotations

import ast

from implementation.references.decorator_protocols import (
    PythonAssignedDescriptorIndexContract,
)
from implementation.references.protocols import (
    PythonContainerValuesContract,
)
from implementation.rules.constants import (
    PYTHON_CLASS_METHOD_DECORATOR,
    PYTHON_CLASS_METHOD_RULE,
    PYTHON_PROPERTY_DECORATOR,
    PYTHON_PROPERTY_DELETER_DECORATOR,
    PYTHON_PROPERTY_SETTER_DECORATOR,
    PYTHON_PROPERTY_SETTER_RULE,
    PYTHON_STATIC_METHOD_DECORATOR,
    PYTHON_STATIC_METHOD_RULE,
)
from implementation.rules.protocols import PythonDecoratorAliasStateContract


class PythonDecoratorRules:
    """Responsibilities: _decorator kind resolution_, _property decorator detection_."""

    def _name_decorator_kind(self, name_node: ast.Name) -> str:
        """Responsibilities: _decorator alias classification_."""
        aliases = self._aliases.aliases()
        if name_node.id in aliases["static"]:
            return PYTHON_STATIC_METHOD_RULE
        if name_node.id in aliases["class"]:
            return PYTHON_CLASS_METHOD_RULE
        if name_node.id in aliases["setter"]:
            return PYTHON_PROPERTY_SETTER_RULE
        return ""

    def _attribute_decorator_kind(self, attribute_node: ast.Attribute) -> str:
        """Responsibilities: _qualified decorator classification_."""
        if attribute_node.attr == PYTHON_STATIC_METHOD_DECORATOR:
            return PYTHON_STATIC_METHOD_RULE
        if attribute_node.attr == PYTHON_CLASS_METHOD_DECORATOR:
            return PYTHON_CLASS_METHOD_RULE
        if attribute_node.attr in {PYTHON_PROPERTY_SETTER_DECORATOR, PYTHON_PROPERTY_DELETER_DECORATOR}:
            return PYTHON_PROPERTY_SETTER_RULE
        return ""

    def _decorator_kind(self, decorator: ast.AST) -> str:
        """Responsibilities: _decorator kind classification_."""
        if type(decorator) is ast.Name:
            return self._name_decorator_kind(decorator)
        if type(decorator) is ast.Attribute:
            return self._attribute_decorator_kind(decorator)
        if type(decorator) is ast.Subscript:
            resolved = self._container_values.container_value(decorator)
            if resolved.found():
                return self._decorator_kind(resolved.expression_node())
        return ""

    def _assigned_kind(self, node: ast.AST) -> str:
        """Responsibilities: _assigned descriptor classification_."""
        assigned_kind = self._assigned_descriptors.kind(node)
        if assigned_kind == "static":
            return PYTHON_STATIC_METHOD_RULE
        if assigned_kind == "class":
            return PYTHON_CLASS_METHOD_RULE
        return ""

    def __init__(
        self,
        container_values: PythonContainerValuesContract,
        aliases: PythonDecoratorAliasStateContract,
        assigned_descriptors: PythonAssignedDescriptorIndexContract,
    ) -> None:
        """Responsibilities: _decorator rule initialization_."""
        self._container_values: PythonContainerValuesContract = container_values
        self._aliases: PythonDecoratorAliasStateContract = aliases
        self._assigned_descriptors: PythonAssignedDescriptorIndexContract = assigned_descriptors

    def property_decorator(self, decorator: ast.AST) -> bool:
        """Responsibilities: _property decorator identification_."""
        if type(decorator) is ast.Name:
            decorator_aliases = self._aliases.aliases()
            property_aliases = decorator_aliases[PYTHON_PROPERTY_DECORATOR]
            return decorator.id in property_aliases
        if type(decorator) is ast.Attribute:
            return decorator.attr == PYTHON_PROPERTY_DECORATOR
        if type(decorator) is ast.Subscript:
            resolved = self._container_values.container_value(decorator)
            if not resolved.found():
                return False
            return self.property_decorator(resolved.expression_node())
        return False

    def kinds(self, node: ast.AST) -> list[str]:
        """Responsibilities: _decorator kind collection_."""
        if type(node) is ast.FunctionDef:
            decorators = node.decorator_list
        else:
            if type(node) is not ast.AsyncFunctionDef:
                return []
            decorators = node.decorator_list
        kinds: list[str] = []
        for decorator in decorators:
            kind = self._decorator_kind(decorator)
            if kind:
                kinds.append(kind)
        assigned_kind = self._assigned_kind(node)
        if assigned_kind:
            kinds.append(assigned_kind)
        return kinds
