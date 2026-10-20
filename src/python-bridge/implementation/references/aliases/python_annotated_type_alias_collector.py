from __future__ import annotations

import ast

from implementation.rules.constants import (
    PYTHON_TYPE_ALIAS_NAME,
    PYTHON_TYPING_EXTENSIONS_MODULE,
    PYTHON_TYPING_MODULE,
)
from implementation.types import JsonObject


class PythonAnnotatedTypeAliasCollector:
    """Responsibilities: _annotated type alias recognition_, _target registration_."""

    def __init__(self, aliases: list[JsonObject]) -> None:
        """Responsibilities: _alias target ownership_."""
        self.aliases: list[JsonObject] = aliases

    def type_alias_annotation(self, annotation: ast.AST) -> bool:
        """Responsibilities: _TypeAlias annotation classification_."""
        if type(annotation) is ast.Name:
            return self.named_type_alias(annotation.id)
        return self.qualified_type_alias(annotation)

    def named_type_alias(self, name: str) -> bool:
        """Responsibilities: _named TypeAlias resolution_."""
        if name == PYTHON_TYPE_ALIAS_NAME:
            return True
        for alias in self.aliases:
            if alias["name"] == name and alias["target"] == PYTHON_TYPE_ALIAS_NAME:
                return True
        return False

    def qualified_type_alias(self, annotation: ast.AST) -> bool:
        """Responsibilities: _qualified TypeAlias recognition_."""
        if type(annotation) is not ast.Attribute:
            return False
        if annotation.attr != PYTHON_TYPE_ALIAS_NAME:
            return False
        if type(annotation.value) is not ast.Name:
            return False
        return annotation.value.id in (
            PYTHON_TYPING_MODULE,
            PYTHON_TYPING_EXTENSIONS_MODULE,
        )

    def append_type_alias(self, node: ast.AST) -> bool:
        """Responsibilities: _annotated type alias targets_."""
        if type(node) is not ast.AnnAssign:
            return False
        if not self.type_alias_annotation(node.annotation):
            return False
        if type(node.target) is ast.Name and node.value is not None:
            self.aliases.append(
                {"name": node.target.id, "target": ast.unparse(node.value)}
            )
        return True
