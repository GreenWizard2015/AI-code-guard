from __future__ import annotations

import ast

from implementation.ast.protocols import PythonAstContentTreeViewContract
from implementation.rules.constants import PYTHON_MAIN_NAME, PYTHON_MAIN_VALUE, PYTHON_TYPE_ALIAS_NAME
from implementation.types import JsonObject, LiteralMetadata


class PythonLiteralMetadata:
    """Responsibilities: _literal classification_, _docstring reference collection_."""

    def _all_export_assignment(self, statement: ast.AST) -> bool:
        """Responsibilities: _module export assignment classification_."""
        if statement not in self._tree.tree().body:
            return False
        if type(statement) is ast.Assign:
            return any(type(target) is ast.Name and target.id == "__all__" for target in statement.targets)
        if type(statement) is ast.AnnAssign:
            return type(statement.target) is ast.Name and statement.target.id == "__all__"
        if type(statement) is ast.AugAssign:
            return type(statement.target) is ast.Name and statement.target.id == "__all__"
        return False

    def _inside_export_assignment(self, export_candidate: ast.AST) -> bool:
        """Responsibilities: _export-name literal exclusion_."""
        current = export_candidate
        while True:
            parents = self._tree.analysis_state().core().source_dependencies().node_index().parents(current)
            if not parents:
                return False
            parent = parents[0]
            if self._all_export_assignment(parent):
                return True
            current = parent

    def _main_guard_literal(self, parent: ast.Compare, guard_literal: ast.AST) -> bool:
        """Responsibilities: _main guard literal exclusion_."""
        if type(parent.left) is not ast.Name or parent.left.id != PYTHON_MAIN_NAME:
            return False
        if len(parent.comparators) != 1:
            return False
        comparator = parent.comparators[0]
        return (
            type(comparator) is ast.Constant and comparator is guard_literal and comparator.value == PYTHON_MAIN_VALUE
        )

    def _parent_excludes_literal(self, candidate_parent: ast.AST, candidate_literal: ast.AST) -> bool:
        """Responsibilities: _literal parent exclusion decision_."""
        if self._annotation_excludes_literal(candidate_parent, candidate_literal):
            return True
        return self._statement_excludes_literal(candidate_parent, candidate_literal)

    def _annotation_excludes_literal(self, annotation_owner: ast.AST, annotation_literal: ast.AST) -> bool:
        """Responsibilities: _annotation literal exclusion_."""
        if type(annotation_owner) is ast.AnnAssign:
            if self._all_export_assignment(annotation_owner):
                return True
            return self._type_alias_annotation(annotation_owner.annotation)
        if type(annotation_owner) is ast.arg:
            return annotation_owner.annotation is annotation_literal
        match annotation_owner:
            case ast.FunctionDef(returns=return_annotation) | ast.AsyncFunctionDef(returns=return_annotation):
                return return_annotation is annotation_literal
            case _:
                return False

    def _statement_excludes_literal(self, statement_owner: ast.AST, statement_literal: ast.AST) -> bool:
        """Responsibilities: _statement literal exclusion_."""
        if type(statement_owner) is ast.Dict and statement_literal in statement_owner.keys:
            return True
        if type(statement_owner) in (ast.Assign, ast.AugAssign):
            return self._all_export_assignment(statement_owner)
        if type(statement_owner) is ast.Compare:
            return self._main_guard_literal(statement_owner, statement_literal)
        return False

    def _type_alias_annotation(self, annotation: ast.AST) -> bool:
        """Responsibilities: _type alias annotation classification_."""
        if type(annotation) is ast.Name:
            return annotation.id == PYTHON_TYPE_ALIAS_NAME
        if type(annotation) is ast.Attribute:
            return annotation.attr == PYTHON_TYPE_ALIAS_NAME
        return False

    def _append_constant(
        self,
        target: ast.AST,
        value: ast.AST,
        recorded_constant_names: dict[int, str],
        constants: list[JsonObject],
    ) -> None:
        """Responsibilities: _constant literal registration_."""
        if type(target) is not ast.Name:
            return
        if not target.id.isupper():
            return
        literal = self.literal_value(value)
        if not literal:
            return
        if type(value) is not ast.Constant:
            return
        recorded_constant_names[id(value)] = target.id
        constants.append(
            {"value": literal, "name": target.id, "line": value.lineno - 1},
        )

    def _append_statement_constants(
        self,
        statement: ast.AST,
        statement_constant_names: dict[int, str],
        constants: list[JsonObject],
    ) -> None:
        """Responsibilities: _assignment constant registration_."""
        if type(statement) is ast.Assign:
            for target in statement.targets:
                self._append_constant(
                    target,
                    statement.value,
                    statement_constant_names,
                    constants,
                )
            return
        if type(statement) is ast.AnnAssign and statement.value is not None:
            self._append_constant(
                statement.target,
                statement.value,
                statement_constant_names,
                constants,
            )

    def _docstrings(self) -> set[int]:
        """Responsibilities: _docstring literal collection_."""
        nodes: set[int] = set()
        for node in self._tree.analysis_state().core().source_dependencies().node_index().nodes(self._tree.tree()):
            if type(node) is not ast.Expr:
                continue
            if type(node.value) is ast.Constant and type(node.value.value) is str:
                nodes.add(id(node.value))
        return nodes

    def _references(
        self,
        known_constants: dict[int, str],
        docstrings: set[int],
    ) -> list[JsonObject]:
        """Responsibilities: _literal reference collection_."""
        references: list[JsonObject] = []
        for node in self._tree.analysis_state().core().source_dependencies().node_index().nodes(self._tree.tree()):
            value = self.literal_value(node)
            if not value:
                continue
            if id(node) in docstrings:
                continue
            if id(node) in known_constants:
                continue
            if type(node) is not ast.Constant:
                continue
            references.append({"value": value, "line": node.lineno - 1})
        return references

    def __init__(self, tree: PythonAstContentTreeViewContract) -> None:
        """Responsibilities: _literal metadata initialization_."""
        self._tree: PythonAstContentTreeViewContract = tree

    def excludes(self, literal_to_exclude: ast.AST) -> bool:
        """Responsibilities: _literal exclusion decision_."""
        if self._inside_export_assignment(literal_to_exclude):
            return True
        parents = self._tree.analysis_state().core().source_dependencies().node_index().parents(literal_to_exclude)
        return any(self._parent_excludes_literal(parent, literal_to_exclude) for parent in parents)

    def literal_value(self, node: ast.AST) -> str:
        """Responsibilities: _literal value classification_."""
        if type(node) is not ast.Constant:
            return ""
        if type(node.value) is not str:
            return ""
        if len(node.value) < 8:
            return ""
        if self.excludes(node):
            return ""
        return node.value

    def collect(self) -> LiteralMetadata:
        """Responsibilities: _literal metadata collection_."""
        constant_values: dict[int, str] = {}
        constants: list[JsonObject] = []
        for statement in self._tree.tree().body:
            self._append_statement_constants(statement, constant_values, constants)
        return {
            "references": self._references(constant_values, self._docstrings()),
            "constants": constants,
        }
