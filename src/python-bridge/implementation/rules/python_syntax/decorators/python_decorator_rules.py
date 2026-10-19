from __future__ import annotations

import ast

from implementation.protocols import (
    PythonAssignedDescriptorIndexContract,
    PythonDecoratorAliasesContract,
)
from implementation.references.aliases.protocols import (
    PythonContainerAliasesContract,
    PythonContainerValuesContract,
    PythonReferenceAliasesContract,
)
from implementation.rules.constants import (
    PYTHON_CLASS_METHOD_DECORATOR,
    PYTHON_CLASS_METHOD_RULE,
    PYTHON_PROPERTY_DECORATOR,
    PYTHON_PROPERTY_SETTER_DECORATOR,
    PYTHON_PROPERTY_SETTER_RULE,
    PYTHON_STATIC_METHOD_DECORATOR,
    PYTHON_STATIC_METHOD_RULE,
)


class PythonDecoratorRules:
    """Responsibilities: _decorator kind resolution_, _property decorator detection_."""

    def _named_kind(self, decorator: ast.AST) -> str:
        """Responsibilities: _named decorator classification_."""
        if type(decorator) is not ast.Name:
            return ""
        aliases = self.aliases.aliases()
        if decorator.id in aliases["static"]:
            return PYTHON_STATIC_METHOD_RULE
        if decorator.id in aliases["class"]:
            return PYTHON_CLASS_METHOD_RULE
        if decorator.id in aliases["setter"]:
            return PYTHON_PROPERTY_SETTER_RULE
        return ""

    def _qualified_kind(self, decorator: ast.AST) -> str:
        """Responsibilities: _qualified decorator classification_."""
        if type(decorator) is not ast.Attribute:
            return ""
        if decorator.attr == PYTHON_STATIC_METHOD_DECORATOR:
            return PYTHON_STATIC_METHOD_RULE
        if decorator.attr == PYTHON_CLASS_METHOD_DECORATOR:
            return PYTHON_CLASS_METHOD_RULE
        if decorator.attr == PYTHON_PROPERTY_SETTER_DECORATOR:
            return PYTHON_PROPERTY_SETTER_RULE
        return ""

    def _decorator_kind(self, decorator: ast.AST) -> str:
        """Responsibilities: _decorator kind classification_."""
        kind = self._named_kind(decorator)
        if kind:
            return kind
        kind = self._qualified_kind(decorator)
        if kind:
            return kind
        return self._subscript_kind(decorator)

    def _subscript_kind(self, decorator: ast.AST) -> str:
        """Responsibilities: _subscript decorator classification_."""
        if type(decorator) is not ast.Subscript:
            return ""
        resolved = self.container_values.container_value(decorator)
        if not resolved.found():
            return ""
        expression = resolved.expression_node()
        kind = self._named_kind(expression)
        if kind:
            return kind
        return self._qualified_kind(expression)

    def _assigned_kind(self, node: ast.AST) -> str:
        """Responsibilities: _assigned descriptor classification_."""
        assigned_kind = self.assigned_descriptors.kind(node)
        if assigned_kind == "static":
            return PYTHON_STATIC_METHOD_RULE
        if assigned_kind == "class":
            return PYTHON_CLASS_METHOD_RULE
        return ""

    def __init__(
        self,
        container_aliases: PythonContainerAliasesContract,
        assignment_aliases: PythonReferenceAliasesContract,
        aliases: PythonDecoratorAliasesContract,
        assigned_descriptors: PythonAssignedDescriptorIndexContract,
    ) -> None:
        """Responsibilities: _decorator rule initialization_."""
        self.container_values: PythonContainerValuesContract = (
            container_aliases.container_values
        )
        self.aliases: PythonDecoratorAliasesContract = aliases
        self.assigned_descriptors: PythonAssignedDescriptorIndexContract = (
            assigned_descriptors
        )

    def property_decorator(self, decorator: ast.AST) -> bool:
        """Responsibilities: _property decorator identification_."""
        if type(decorator) is ast.Name:
            decorator_aliases = self.aliases.aliases()
            property_aliases = decorator_aliases[PYTHON_PROPERTY_DECORATOR]
            return decorator.id in property_aliases
        if type(decorator) is ast.Attribute:
            return decorator.attr == PYTHON_PROPERTY_DECORATOR
        if type(decorator) is ast.Subscript:
            resolved = self.container_values.container_value(decorator)
            if not resolved.found():
                return False
            return self.property_decorator(resolved.expression_node())
        return False

    def kinds(self, node: ast.AST) -> list[str]:
        """Responsibilities: _decorator kind collection_."""
        if type(node) not in (ast.FunctionDef, ast.AsyncFunctionDef):
            return []
        kinds: list[str] = []
        for decorator in node.decorator_list:
            kind = self._decorator_kind(decorator)
            if kind:
                kinds.append(kind)
        assigned_kind = self._assigned_kind(node)
        if assigned_kind:
            kinds.append(assigned_kind)
        return kinds
