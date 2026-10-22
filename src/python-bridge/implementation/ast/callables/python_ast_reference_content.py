from __future__ import annotations

import ast
from collections.abc import Callable
from time import perf_counter
from typing import Any

from implementation.ast.protocols import (
    PythonLiteralMetadataContract,
    PythonResponsibilityTargetsContract,
)
from protocols import PythonAstContentTreeContract
from implementation.rules.constants import PYTHON_MAIN_NAME, PYTHON_MAIN_VALUE
from implementation.types import (
    JsonObject,
    JsonValue,
)
from implementation.types import LiteralMetadata

PythonAstReferenceOperation = Callable[[], JsonValue]


class PythonAstReferenceContent:
    """Responsibilities: _symbol reference collection_, _AST metadata reporting_."""

    def _timed(
        self, stage_name: str, operation: PythonAstReferenceOperation
    ) -> JsonValue:
        """Responsibilities: _reference stage measurement_."""
        started = perf_counter()
        try:
            return operation()
        finally:
            timings = self.tree.timings_data()
            timings[stage_name] = (perf_counter() - started) * 1000

    def _main_guard_node(self, node: ast.AST) -> bool:
        """Responsibilities: _main guard node classification_."""
        if type(node) is not ast.If:
            return False
        test: Any = node.test
        if type(test) is not ast.Compare or len(test.ops) != 1:
            return False
        if type(test.ops[0]) is not ast.Eq or len(test.comparators) != 1:
            return False
        if type(test.left) is not ast.Name or test.left.id != PYTHON_MAIN_NAME:
            return False
        comparator: Any = test.comparators[0]
        return (
            type(comparator) is ast.Constant and comparator.value == PYTHON_MAIN_VALUE
        )

    def _export_names(self, value: ast.AST) -> list[str]:
        """Responsibilities: _static Python export-name extraction_."""
        if type(value) is ast.Constant and type(value.value) is str:
            return [value.value]
        if type(value) in (ast.List, ast.Tuple, ast.Set):
            names: list[str] = []
            for item in value.elts:
                names.extend(self._export_names(item))
            return names
        if type(value) is ast.BinOp and type(value.op) is ast.Add:
            return self._export_names(value.left) + self._export_names(value.right)
        return []

    def _is_all_assignment(self, statement: ast.stmt) -> bool:
        """Responsibilities: _module export assignment classification_."""
        if type(statement) is ast.Assign:
            return any(
                type(target) is ast.Name and target.id == "__all__"
                for target in statement.targets
            )
        if type(statement) in (ast.AnnAssign, ast.AugAssign):
            target: Any = statement.target
            return type(target) is ast.Name and target.id == "__all__"
        return False

    def _assignment_exports(self, statement: ast.stmt) -> list[str]:
        """Responsibilities: _assigned Python export names_."""
        if type(statement) is ast.Assign:
            return self._export_names(statement.value)
        if type(statement) in (ast.AnnAssign, ast.AugAssign):
            if statement.value is not None:
                return self._export_names(statement.value)
        return []

    def _python_exports(self) -> list[str]:
        """Responsibilities: _static module export metadata_."""
        names: list[str] = []
        for statement in self.tree.tree.body:
            if not self._is_all_assignment(statement):
                continue
            if type(statement) is ast.AnnAssign and statement.value is None:
                continue
            declared = self._assignment_exports(statement)
            if type(statement) is ast.AugAssign:
                names.extend(declared)
                continue
            names = declared
        return list(dict.fromkeys(names))

    def _docstring_span(self, value: ast.Constant) -> dict[str, int]:
        """Responsibilities: _docstring span conversion_."""
        end_line: Any = value.end_lineno or value.lineno
        end_column: Any = value.end_col_offset or value.col_offset
        return {
            "start_line": value.lineno - 1,
            "start_column": value.col_offset,
            "end_line": end_line - 1,
            "end_column": end_column,
        }

    def _docstring_spans(self) -> list[JsonObject]:
        """Responsibilities: _docstring span collection_."""
        spans: list[dict[str, int]] = []
        owners: Any = (ast.Module, ast.ClassDef, ast.FunctionDef, ast.AsyncFunctionDef)
        for node in self.tree.node_index.nodes(self.tree.tree):
            if type(node) not in owners:
                continue
            body: Any = node.body
            if not body:
                continue
            if not self.tree.callable_statements.string_statement(body[0]):
                continue
            spans.append(self._docstring_span(body[0].value))
        return spans

    def _reference_data(
        self, literals: LiteralMetadata, call_references: list[JsonObject]
    ) -> JsonObject:
        """Responsibilities: _runtime reference content_."""
        return {
            "call_references": call_references,
            "python_imports": self._timed(
                "python-imports", self.tree.import_nodes.import_records
            ),
            "python_exports": self._timed("python-exports", self._python_exports),
            "python_main_guard": self._timed(
                "main-guard",
                lambda: any(
                    self._main_guard_node(node) for node in self.tree.tree.body
                ),
            ),
            "reference_aliases": self._timed(
                "reference-aliases",
                lambda: self.tree.reference_aliases.collect(self.tree.tree),
            ),
            "symbol_references": self._timed(
                "symbol-references", self.symbol_references
            ),
            "literal_references": literals["references"],
            "literal_constants": literals["constants"],
        }

    def _metadata_data(self) -> JsonObject:
        """Responsibilities: _reference metadata content_."""
        return {
            "docstring_spans": self._timed("docstring-spans", self._docstring_spans),
            "responsibility_targets": self._timed(
                "responsibility-targets", self.responsibility_target_collector.collect
            ),
        }

    def __init__(
        self,
        tree: PythonAstContentTreeContract,
        literal_metadata: PythonLiteralMetadataContract,
        responsibility_target_collector: PythonResponsibilityTargetsContract,
    ) -> None:
        """Responsibilities: _reference content initialization_."""
        self.tree: PythonAstContentTreeContract = tree
        self.literal_metadata: PythonLiteralMetadataContract = literal_metadata
        self.responsibility_target_collector: PythonResponsibilityTargetsContract = (
            responsibility_target_collector
        )

    def symbol_references(self) -> list[JsonObject]:
        """Responsibilities: _named symbol usage collection_."""
        references: list[JsonObject] = []
        for node in self.tree.node_index.nodes(self.tree.tree):
            if type(node) is ast.Name and type(node.ctx) is ast.Load:
                references.append({"name": node.id, "line": node.lineno - 1})
            if type(node) is ast.Attribute:
                references.append({"name": node.attr, "line": node.lineno - 1})
        return references

    def collect(self) -> JsonObject:
        """Responsibilities: _reference content collection_."""
        literals = self._timed("literal-metadata", self.literal_metadata.collect)
        call_references = self._timed(
            "call-references", self.tree.references.collect_references
        )
        self.tree.timings_data().update(self.tree.references.timings_data())
        return {
            **self._reference_data(literals, call_references),
            **self._metadata_data(),
            "coding_issues": self._timed("coding-issues", self.tree.coding_issues),
        }
