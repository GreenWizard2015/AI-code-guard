from __future__ import annotations

import ast
from typing import Any

from implementation.references.aliases.python_reference_aliases import (
    PythonReferenceAliases,
)
from implementation.types import JsonObject
from implementation.rules.constants import (
    PYTHON_PROTOCOL_NAME,
    PYTHON_TYPE_ALIAS_NAME,
    PYTHON_TYPING_EXTENSIONS_MODULE,
    PYTHON_TYPING_MODULE,
)


class PythonModuleConstantSpans:
    """Responsibilities: _module constant span collection_, _type protocol declaration collection_."""

    def _type_alias_names(self) -> set[str]:
        """Responsibilities: _collection TypeAlias import names_."""
        names = {PYTHON_TYPE_ALIAS_NAME}
        reference_aliases = PythonReferenceAliases()
        aliases = reference_aliases.collect(self.tree)
        for alias in aliases:
            name = str(alias["name"])
            if reference_aliases.resolved_name(
                name, frozenset({PYTHON_TYPE_ALIAS_NAME})
            ):
                names.add(name)
        return names

    def _type_alias_annotation(self, annotation: ast.AST) -> bool:
        """Responsibilities: _classification type alias annotation_."""
        if type(annotation) is ast.Name:
            return annotation.id in self._type_alias_names()
        if type(annotation) is not ast.Attribute:
            return False
        if annotation.attr != PYTHON_TYPE_ALIAS_NAME:
            return False
        if type(annotation.value) is not ast.Name:
            return False
        return annotation.value.id in {
            PYTHON_TYPING_MODULE,
            PYTHON_TYPING_EXTENSIONS_MODULE,
        }

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
            return any(self._constant_target(target) for target in node.targets)
        if type(node) is ast.AnnAssign:
            return self._annotated_constant(node)
        return False

    def _constant_target(self, target: ast.AST) -> bool:
        """Responsibilities: _classification uppercase constant target_."""
        if type(target) is not ast.Name:
            return False
        return target.id.isupper()

    def _annotated_constant(self, node: ast.AnnAssign) -> bool:
        """Responsibilities: _classification annotated constant target_."""
        if type(node.target) is not ast.Name:
            return False
        if node.target.id.isupper():
            return True
        return self._is_final_annotation(node.annotation)

    def _is_final_annotation(self, annotation: ast.AST) -> bool:
        """Responsibilities: _classification final constant annotation_."""
        if type(annotation) is ast.Name:
            return annotation.id == "Final"
        if type(annotation) is ast.Attribute:
            return annotation.attr == "Final"
        if type(annotation) is ast.Subscript:
            return self._is_final_annotation(annotation.value)
        return False

    def _module_nodes(self, statements: list[ast.stmt]) -> list[ast.stmt]:
        """Responsibilities: _collection conditional module statements_."""
        nodes: list[ast.stmt] = []
        for node in statements:
            nodes.append(node)
            nested = self._nested_statements(node)
            nodes.extend(self._module_nodes(nested))
        return nodes

    def _nested_statements(self, node: ast.stmt) -> list[ast.stmt]:
        """Responsibilities: _nested module statement collection_."""
        if type(node) in (ast.If, ast.For, ast.AsyncFor, ast.While):
            return [*node.body, *node.orelse]
        if type(node) in (ast.With, ast.AsyncWith):
            return list(node.body)
        if type(node) in (ast.Try, ast.TryStar):
            return self._try_statements(node)
        if type(node) is ast.Match:
            return [statement for case in node.cases for statement in case.body]
        return []

    def _try_statements(self, node: ast.AST) -> list[ast.stmt]:
        """Responsibilities: _nested try statement collection_."""
        nested = [*node.body, *node.orelse, *node.finalbody]
        for handler in node.handlers:
            nested.extend(handler.body)
        return nested

    def _is_type_alias(self, node: ast.AST) -> bool:
        """Responsibilities: _classification module assignment type_."""
        is_annotated_assignment = type(node) is ast.AnnAssign
        if not is_annotated_assignment:
            return False
        if type(node.target) is not ast.Name:
            return False
        return self._type_alias_annotation(node.annotation)

    def _is_protocol(self, node: ast.AST) -> bool:
        """Responsibilities: _classification class declaration Protocol_."""
        if type(node) is not ast.ClassDef:
            return False
        return any(self._is_protocol_base(base) for base in node.bases)

    def _is_protocol_base(self, base: ast.AST) -> bool:
        """Responsibilities: _classification base expression Protocol_."""
        if type(base) is ast.Name:
            return base.id == PYTHON_PROTOCOL_NAME
        if type(base) is ast.Attribute:
            return base.attr == PYTHON_PROTOCOL_NAME
        return False

    def __init__(self, tree: ast.Module) -> None:
        """Responsibilities: _initialization module tree usage_."""
        self.tree: Any = tree

    def collect_spans(self) -> list[JsonObject]:
        """Responsibilities: _collection source spans module_."""
        spans: list[dict[str, int]] = []
        for node in self._module_nodes(self.tree.body):
            if self._is_constant_assignment(node):
                spans.append(self._span(node))
        return spans

    def collect_types(self) -> list[JsonObject]:
        """Responsibilities: _collection source spans module_."""
        spans: list[dict[str, int]] = []
        for node in self.tree.body:
            if self._is_type_alias(node):
                spans.append(self._span(node))
        return spans

    def collect_protocols(self) -> list[JsonObject]:
        """Responsibilities: _collection source spans module_."""
        spans: list[dict[str, int]] = []
        for node in self.tree.body:
            if self._is_protocol(node):
                spans.append(self._span(node))
        return spans
