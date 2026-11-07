from __future__ import annotations

import ast

from implementation.rules.constants import PYTHON_OPTIONAL_NAME, PYTHON_UNION_NAME
from implementation.rules.protocols import PythonUndefinedCheckStateContract
from implementation.types import JsonObject, PythonClassFieldMap


class PythonUnnecessaryUndefinedCheck:
    """Responsibilities: _optional annotation analysis_, _redundant check collection_."""

    def _annotation_none(self, annotation: ast.expr) -> bool:
        """Responsibilities: _classification annotation explicitly allows_."""
        if type(annotation) is ast.Constant:
            if annotation.value is None:
                return True
        if type(annotation) is ast.Name:
            return annotation.id in {"Any", "None", PYTHON_OPTIONAL_NAME}
        if type(annotation) is ast.BinOp:
            if self._union_annotation_none(annotation):
                return True
        if type(annotation) is ast.Subscript:
            return self._subscript_annotation_none(annotation)
        return False

    def _union_annotation_none(self, annotation: ast.BinOp) -> bool:
        """Responsibilities: _classification union annotation includes_."""
        if type(annotation.op) is not ast.BitOr:
            return False
        if self._annotation_none(annotation.left):
            return True
        return self._annotation_none(annotation.right)

    def _subscript_annotation_none(self, annotation: ast.Subscript) -> bool:
        """Responsibilities: _classification generic annotation includes_."""
        if type(annotation.value) is not ast.Name:
            return False
        if annotation.value.id not in {PYTHON_OPTIONAL_NAME, PYTHON_UNION_NAME}:
            return False
        values: list[ast.expr] = [annotation.slice]
        if type(annotation.slice) is ast.Tuple:
            values = annotation.slice.elts
        return any(self._annotation_none(value) for value in values)

    def _attribute_path(self, attribute: ast.Attribute) -> list[str]:
        """Responsibilities: _attribute ownership path_."""
        path: list[str] = []
        current: ast.AST = attribute
        while type(current) is ast.Attribute:
            path.append(current.attr)
            current = current.value
        if type(current) is not ast.Name:
            return []
        path.append(current.id)
        path.reverse()
        return path

    def _field_annotation(
        self,
        attribute: ast.Attribute,
        bindings: dict[str, ast.expr],
        fields: PythonClassFieldMap,
    ) -> ast.expr:
        """Responsibilities: _resolution annotation field referenced_."""
        path = self._attribute_path(attribute)
        if not path:
            return ast.Constant(value=None)
        annotation = bindings.get(path[0])
        for field_name in path[1:]:
            if type(annotation) is not ast.Name:
                return ast.Constant(value=None)
            field = fields.get(annotation.id, {}).get(field_name)
            if field is None:
                return ast.Constant(value=None)
            annotation = field
        if annotation is None:
            return ast.Constant(value=None)
        return annotation

    def _is_none_comparison(self, node: ast.Compare) -> bool:
        """Responsibilities: _classification comparison against None_."""
        if len(node.ops) != 1:
            return False
        if len(node.comparators) != 1:
            return False
        if type(node.left) is not ast.Attribute:
            return False
        if type(node.comparators[0]) is not ast.Constant:
            return False
        if node.comparators[0].value is not None:
            return False
        return type(node.ops[0]) in (ast.Is, ast.IsNot, ast.Eq, ast.NotEq)

    def __init__(
        self,
        tree: ast.Module,
        state: PythonUndefinedCheckStateContract,
    ) -> None:
        """Responsibilities: _initialization module tree caching_."""
        self._tree: ast.Module = tree
        self._state: PythonUndefinedCheckStateContract = state

    def detected(self, node: ast.Compare) -> bool:
        """Responsibilities: _reporting comparison unnecessary undefined_."""
        if not self._is_none_comparison(node):
            return False
        if type(node.left) is not ast.Attribute:
            return False
        annotation = self._field_annotation(
            node.left,
            self._state.bindings(),
            self._state.fields(),
        )
        if type(annotation) is ast.Constant:
            if annotation.value is None:
                return False
        return not self._annotation_none(annotation)

    def collect_checks(self, node: ast.AST) -> list[JsonObject]:
        """Responsibilities: _collection unnecessary undefined-check diagnostics_."""
        if type(node) is not ast.Compare:
            return []
        if not self.detected(node):
            return []
        return [{"line": node.lineno - 1, "kind": "unnecessary-undefined-check"}]
