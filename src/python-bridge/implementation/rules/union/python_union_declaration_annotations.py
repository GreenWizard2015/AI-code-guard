from __future__ import annotations

import ast
from functools import cached_property

from implementation.ast.protocols import PythonAstNodeIndexContract
from implementation.rules.constants import (
    PYTHON_BUILTINS_MODULE,
    PYTHON_TYPING_EXTENSIONS_MODULE,
    PYTHON_TYPING_MODULE,
)
from implementation.rules.union.protocols import (
    PythonConditionalTypeAliasAnalysisContract,
    PythonUnionDeclarationAnnotationsContract,
)


class PythonUnionDeclarationAnnotations(PythonUnionDeclarationAnnotationsContract):
    """Responsibilities: _declaration annotation lookup_, _module alias indexing_."""

    def _module_alias_statement(self, statement: ast.stmt) -> bool:
        """Responsibilities: _module alias statement selection_."""
        if type(statement) in (ast.Assign, ast.AnnAssign):
            return True
        if type(statement) is ast.Import:
            return any(alias.name == PYTHON_BUILTINS_MODULE for alias in statement.names)
        if type(statement) is not ast.ImportFrom:
            return False
        return statement.module in (PYTHON_TYPING_MODULE, PYTHON_TYPING_EXTENSIONS_MODULE)

    def __init__(
        self,
        tree: ast.AST,
        node_index: PythonAstNodeIndexContract,
        type_alias_analysis: PythonConditionalTypeAliasAnalysisContract,
    ) -> None:
        """Responsibilities: _annotation source ownership_."""
        self._tree: ast.AST = tree
        self._node_index: PythonAstNodeIndexContract = node_index
        self._type_alias_analysis: PythonConditionalTypeAliasAnalysisContract = type_alias_analysis

    @cached_property
    def _field_annotations(self) -> set[int]:
        """Responsibilities: _class field annotation index_."""
        annotations: set[int] = set()
        for class_node in self._node_index.nodes(self._tree):
            if type(class_node) is not ast.ClassDef:
                continue
            for statement in class_node.body:
                if type(statement) is ast.AnnAssign:
                    annotations.add(id(statement))
        return annotations

    @cached_property
    def _module_alias_statements(self) -> list[ast.stmt]:
        """Responsibilities: _module typing alias statements_."""
        if type(self._tree) is not ast.Module:
            return []
        return [statement for statement in self._tree.body if self._module_alias_statement(statement)]

    def module_alias_statements(self) -> list[ast.stmt]:
        """Responsibilities: _module typing alias access_."""
        return self._module_alias_statements

    def field_declaration(self, field_candidate: ast.AST) -> bool:
        """Responsibilities: _field declaration classification_."""
        if type(field_candidate) is not ast.AnnAssign:
            return False
        return id(field_candidate) in self._field_annotations

    def _assignment_annotations(self, assignment_statement: ast.AST) -> list[ast.AST]:
        """Responsibilities: _assigned type annotation collection_."""
        if type(assignment_statement) is not ast.Assign:
            return []
        if self._type_alias_analysis.type_alias(assignment_statement.value):
            return [assignment_statement.value]
        return []

    def _field_annotation(self, field_statement: ast.AST) -> list[ast.AST]:
        """Responsibilities: _field type annotation collection_."""
        if type(field_statement) is not ast.AnnAssign:
            return []
        if not self.field_declaration(field_statement):
            return []
        return [field_statement.annotation]

    def _callable_annotations(self, callable_declaration: ast.AST) -> list[ast.AST]:
        """Responsibilities: _callable type annotation collection_."""
        if type(callable_declaration) is ast.arg:
            if callable_declaration.annotation is not None:
                return [callable_declaration.annotation]
            return []
        if type(callable_declaration) is ast.FunctionDef:
            returns = callable_declaration.returns
        else:
            if type(callable_declaration) is not ast.AsyncFunctionDef:
                return []
            returns = callable_declaration.returns
        if returns is None:
            return []
        return [returns]

    def annotations(self, declaration_node: ast.AST) -> list[ast.AST]:
        """Responsibilities: _declaration annotation lookup_."""
        values = self._assignment_annotations(declaration_node)
        if values:
            return values
        values = self._field_annotation(declaration_node)
        if values:
            return values
        return self._callable_annotations(declaration_node)
