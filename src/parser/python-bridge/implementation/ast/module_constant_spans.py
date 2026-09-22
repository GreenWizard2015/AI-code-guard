from __future__ import annotations
from typing import Any


import ast


class PythonModuleConstantSpans:
    """Responsibilities: _Python module constants lookup_."""

    def _span(self, node: ast.AST) -> dict[str, int]:
        """Responsibilities: _module declaration source conversion_."""
        end_line: Any = node.lineno + self._span_line_count(node)
        end_line = end_line - 1
        end_column: Any = node.end_col_offset
        if end_column is None:
            end_column: Any = node.col_offset
        return {
            "start_line": node.lineno - 1,
            "start_column": node.col_offset,
            "end_line": end_line - 1,
            "end_column": end_column,
        }

    def _span_line_count(self, node: ast.AST) -> int:
        """Responsibilities: _calculation line count represented_."""
        end_line: Any = node.end_lineno
        if end_line is None:
            end_line: Any = node.lineno
        line_count = end_line - node.lineno
        return line_count + 1

    def _is_constant_assignment(self, node: ast.AST) -> bool:
        """Responsibilities: _classification module assignment constant_."""
        if type(node) is ast.Assign:
            return any(
                type(target) is ast.Name and target.id.isupper()
                for target in node.targets
            )
        if type(node) is ast.AnnAssign:
            return type(node.target) is ast.Name and node.target.id.isupper()
        return False

    def _is_type_alias(self, node: ast.AST) -> bool:
        """Responsibilities: _classification module assignment type_."""
        is_annotated_assignment = type(node) is ast.AnnAssign
        if not is_annotated_assignment or type(node.target) is not ast.Name:
            return False
        annotation: Any = node.annotation
        is_named_annotation = type(annotation) is ast.Name
        return is_named_annotation and annotation.id == "TypeAlias"

    def _is_protocol(self, node: ast.AST) -> bool:
        """Responsibilities: _classification class declaration Protocol_."""
        if type(node) is not ast.ClassDef:
            return False
        return any(self._is_protocol_base(base) for base in node.bases)

    def _is_protocol_base(self, base: ast.AST) -> bool:
        """Responsibilities: _classification base expression Protocol_."""
        if type(base) is ast.Name:
            return base.id == "Protocol"
        if type(base) is ast.Attribute:
            return base.attr == "Protocol"
        return False

    def __init__(self, tree: ast.Module) -> None:
        """Responsibilities: _initialization module tree usage_."""
        self.tree: Any = tree

    def collect_spans(self) -> list[dict[str, int]]:
        """Responsibilities: _collection source spans module_."""
        spans: list[dict[str, int]] = []
        for node in self.tree.body:
            if self._is_constant_assignment(node):
                spans.append(self._span(node))
        return spans

    def collect_types(self) -> list[dict[str, int]]:
        """Responsibilities: _collection source spans module_."""
        spans: list[dict[str, int]] = []
        for node in self.tree.body:
            if self._is_type_alias(node):
                spans.append(self._span(node))
        return spans

    def collect_protocols(self) -> list[dict[str, int]]:
        """Responsibilities: _collection source spans module_."""
        spans: list[dict[str, int]] = []
        for node in self.tree.body:
            if self._is_protocol(node):
                spans.append(self._span(node))
        return spans
