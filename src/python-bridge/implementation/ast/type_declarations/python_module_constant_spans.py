from __future__ import annotations

import ast
from functools import cached_property
from typing import cast

from implementation.ast.protocols import PythonAstNodeIndexContract
from implementation.references.aliases.python_reference_aliases import (
    PythonReferenceAliases,
    PythonReferenceAliasState,
)
from implementation.rules.constants import (
    PYTHON_CONSTANT_KIND,
    PYTHON_MODULE_NESTED_STATEMENT_TYPES,
    PYTHON_OTHER_DECLARATION_KIND,
    PYTHON_PROTOCOL_DECLARATION_KIND,
    PYTHON_PROTOCOL_NAME,
    PYTHON_TYPE_ALIAS_DECLARATION_KIND,
    PYTHON_TYPE_ALIAS_NAME,
    PYTHON_TYPING_EXTENSIONS_MODULE,
    PYTHON_TYPING_MODULE,
)
from implementation.types import JsonObject, PythonASTLocatedNode


class PythonModuleConstantSpans:
    """Responsibilities: _module constant spans_, _type alias spans_, _protocol spans_."""

    _tree: ast.Module

    @cached_property
    def _type_alias_names(self) -> frozenset[str]:
        """Responsibilities: _imported TypeAlias names_."""
        references = PythonReferenceAliases(PythonReferenceAliasState())
        names = {PYTHON_TYPE_ALIAS_NAME}
        type_alias_names = frozenset({PYTHON_TYPE_ALIAS_NAME})
        nodes = self._node_index.nodes(self._tree)
        for alias in references.collect(self._tree, nodes):
            name = str(alias["name"])
            if references.resolved_name(name, type_alias_names):
                names.add(name)
        return frozenset(names)

    def _final_annotation(self, annotation: ast.AST) -> bool:
        """Responsibilities: _Final annotation recognition_."""
        while type(annotation) is ast.Subscript:
            annotation = annotation.value
        if type(annotation) is ast.Name:
            return annotation.id == "Final"
        if type(annotation) is ast.Attribute:
            return annotation.attr == "Final"
        return False

    def _constant(self, declaration: ast.stmt) -> bool:
        """Responsibilities: _module constant recognition_."""
        if type(declaration) is ast.Assign:
            return any(self._uppercase_name(target) for target in declaration.targets)
        if type(declaration) is not ast.AnnAssign:
            return False
        if self._uppercase_name(declaration.target):
            return True
        return self._final_annotation(declaration.annotation)

    def _uppercase_name(self, candidate: ast.AST) -> bool:
        """Responsibilities: _uppercase declaration recognition_."""
        if type(candidate) is not ast.Name:
            return False
        return candidate.id.isupper()

    def _type_alias(self, declaration: ast.AnnAssign) -> bool:
        """Responsibilities: _module type alias recognition_."""
        if type(declaration.target) is not ast.Name:
            return False
        annotation = declaration.annotation
        if type(annotation) is ast.Name:
            return annotation.id in self._type_alias_names
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

    def _protocol(self, declaration: ast.ClassDef) -> bool:
        """Responsibilities: _Protocol class recognition_."""
        for base in declaration.bases:
            if type(base) is ast.Name and base.id == PYTHON_PROTOCOL_NAME:
                return True
            if type(base) is ast.Attribute and base.attr == PYTHON_PROTOCOL_NAME:
                return True
        return False

    def _kind(self, declaration: ast.stmt) -> str:
        """Responsibilities: _module declaration classification_."""
        if self._constant(declaration):
            return PYTHON_CONSTANT_KIND
        if type(declaration) is ast.AnnAssign:
            if self._type_alias(declaration):
                return PYTHON_TYPE_ALIAS_DECLARATION_KIND
        if type(declaration) is ast.ClassDef:
            if self._protocol(declaration):
                return PYTHON_PROTOCOL_DECLARATION_KIND
        return PYTHON_OTHER_DECLARATION_KIND

    def _nested_statements(self, node: ast.stmt) -> list[ast.stmt]:
        """Responsibilities: _nested module statement extraction_."""
        if type(node) not in PYTHON_MODULE_NESTED_STATEMENT_TYPES:
            return []
        statements: list[ast.stmt] = []
        for child in ast.iter_child_nodes(node):
            match child:
                case ast.stmt() as statement:
                    statements.append(statement)
                case _:
                    continue
        for child in ast.iter_child_nodes(node):
            if type(child) is ast.ExceptHandler:
                statements.extend(child.body)
            if type(child) is ast.match_case:
                statements.extend(child.body)
        return statements

    def _module_statements(self) -> list[ast.stmt]:
        """Responsibilities: _recursive module declaration traversal_."""
        statements: list[ast.stmt] = []
        pending = list(reversed(self._tree.body))
        while pending:
            statement = pending.pop()
            statements.append(statement)
            pending.extend(reversed(self._nested_statements(statement)))
        return statements

    def _span(self, node: ast.AST) -> JsonObject:
        """Responsibilities: _source span record creation_."""
        position = cast(PythonASTLocatedNode, node)
        end_line = position.lineno
        source_end_line = position.end_lineno
        if source_end_line is not None:
            end_line = source_end_line
        end_column = position.col_offset
        source_end_column = position.end_col_offset
        if source_end_column is not None:
            end_column = source_end_column
        return {
            "start_line": position.lineno - 1,
            "start_column": position.col_offset,
            "end_line": end_line - 1,
            "end_column": end_column,
        }

    def _matching_spans(
        self,
        statements: list[ast.stmt],
        kind: str,
    ) -> list[JsonObject]:
        """Responsibilities: _matching declaration span collection_."""
        spans: list[JsonObject] = []
        for statement in statements:
            if self._kind(statement) != kind:
                continue
            spans.append(self._span(statement))
        return spans

    def __init__(self, tree: ast.Module, node_index: PythonAstNodeIndexContract) -> None:
        """Responsibilities: _module declaration analysis dependencies_."""
        self._tree: ast.Module = tree
        self._node_index: PythonAstNodeIndexContract = node_index

    def collect_spans(self) -> list[JsonObject]:
        """Responsibilities: _module constant span collection_."""
        return self._matching_spans(self._module_statements(), PYTHON_CONSTANT_KIND)

    def collect_types(self) -> list[JsonObject]:
        """Responsibilities: _module type span collection_."""
        return self._matching_spans(self._tree.body, PYTHON_TYPE_ALIAS_DECLARATION_KIND)

    def collect_protocols(self) -> list[JsonObject]:
        """Responsibilities: _module Protocol span collection_."""
        return self._matching_spans(self._tree.body, PYTHON_PROTOCOL_DECLARATION_KIND)
