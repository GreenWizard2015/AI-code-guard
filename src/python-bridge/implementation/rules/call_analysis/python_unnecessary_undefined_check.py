from __future__ import annotations

import ast
from typing import Any

from implementation.protocols import PythonUndefinedCheckStateContract
from implementation.types import JsonObject
from implementation.rules.constants import PYTHON_OPTIONAL_NAME, PYTHON_UNION_NAME


class PythonUnnecessaryUndefinedCheck:
    """Responsibilities: _optional annotation analysis_, _redundant check collection_."""

    def _annotation_none(self, annotation: ast.expr) -> bool:
        """Responsibilities: _classification annotation explicitly allows_."""
        is_constant = type(annotation) is ast.Constant
        if is_constant:
            if annotation.value is None:
                return True
        if type(annotation) is ast.Name:
            return annotation.id in {"Any", "None", PYTHON_OPTIONAL_NAME}
        if self._union_annotation_none(annotation):
            return True
        return self._subscript_annotation_none(annotation)

    def _union_annotation_none(self, annotation: ast.expr) -> bool:
        """Responsibilities: _classification union annotation includes_."""
        if type(annotation) is not ast.BinOp:
            return False
        if type(annotation.op) is not ast.BitOr:
            return False
        if self._annotation_none(annotation.left):
            return True
        return self._annotation_none(annotation.right)

    def _subscript_annotation_none(self, annotation: ast.expr) -> bool:
        """Responsibilities: _classification generic annotation includes_."""
        if type(annotation) is not ast.Subscript:
            return False
        if type(annotation.value) is not ast.Name:
            return False
        if annotation.value.id not in {PYTHON_OPTIONAL_NAME, PYTHON_UNION_NAME}:
            return False
        values: Any = [annotation.slice]
        if type(annotation.slice) is ast.Tuple:
            values = annotation.slice.elts
        return any(self._annotation_none(value) for value in values)

    def _attribute_names(self, attribute: ast.Attribute) -> list[str]:
        """Responsibilities: _attribute path names_."""
        path: list[str] = []
        current: ast.AST = attribute
        while type(current) is ast.Attribute:
            path.append(current.attr)
            current = current.value
        return path

    def _attribute_base(self, attribute: ast.Attribute) -> ast.AST:
        """Responsibilities: _attribute path base_."""
        current: ast.AST = attribute
        while type(current) is ast.Attribute:
            current = current.value
        return current

    def _field_annotation(
        self,
        attribute: ast.Attribute,
        bindings: dict,
        fields: dict,
    ) -> ast.expr:
        """Responsibilities: _resolution annotation field referenced_."""
        path = self._attribute_names(attribute)
        current = self._attribute_base(attribute)
        if type(current) is not ast.Name:
            return ast.Constant(value=None)
        annotation: Any = bindings.get(current.id)
        for field_name in reversed(path):
            if type(annotation) is not ast.Name:
                return ast.Constant(value=None)
            field: Any = fields.get(annotation.id, {}).get(field_name)
            if field is None:
                return ast.Constant(value=None)
            annotation = field
        return annotation

    def _is_none_comparison(self, node: ast.Compare) -> bool:
        """Responsibilities: _classification comparison against None_."""
        if len(node.ops) != 1:
            return False
        if len(node.comparators) != 1:
            return False
        if type(node.left) is not ast.Attribute:
            return False
        is_not_constant = type(node.comparators[0]) is not ast.Constant
        if is_not_constant:
            return False
        if node.comparators[0].value is not None:
            return False
        return type(node.ops[0]) in (ast.Is, ast.IsNot, ast.Eq, ast.NotEq)

    def __init__(
        self, tree: ast.Module, state: PythonUndefinedCheckStateContract
    ) -> None:
        """Responsibilities: _initialization module tree caching_."""
        self.tree: Any = tree
        self.state: PythonUndefinedCheckStateContract = state

    def detected(self, node: ast.Compare) -> bool:
        """Responsibilities: _reporting comparison unnecessary undefined_."""
        if not self._is_none_comparison(node):
            return False
        annotation: Any = self._field_annotation(
            node.left, self.state.bindings(), self.state.fields()
        )
        is_none_constant = type(annotation) is ast.Constant
        if is_none_constant:
            if annotation.value is None:
                return False
        return not self._annotation_none(annotation)

    def collect_checks(self, node: ast.AST) -> list[JsonObject]:
        """Responsibilities: _collection unnecessary undefined-check diagnostics_."""
        is_comparison = type(node) is ast.Compare
        if not is_comparison:
            return []
        if not self.detected(node):
            return []
        return [{"line": node.lineno - 1, "kind": "unnecessary-undefined-check"}]
