from __future__ import annotations

import ast
from collections.abc import Iterator
from contextlib import contextmanager
from time import perf_counter

from implementation.ast.constants import AST_REFERENCES_KEY
from implementation.ast.protocols import (
    PythonAstContentTreeViewContract,
    PythonAstMetadataContract,
    PythonLiteralMetadataContract,
    PythonResponsibilityTargetsContract,
)
from implementation.rules.constants import PYTHON_MAIN_NAME, PYTHON_MAIN_VALUE
from implementation.types import JsonObject, JsonValueList, LiteralMetadata


class PythonAstReferenceContent:
    """Responsibilities: _symbol reference collection_, _AST metadata reporting_."""

    def _json_records(self, records: list[JsonObject]) -> JsonValueList:
        """Responsibilities: _JSON record conversion_."""
        values: JsonValueList = []
        values.extend(records)
        return values

    def _json_strings(self, strings: list[str]) -> JsonValueList:
        """Responsibilities: _JSON string conversion_."""
        values: JsonValueList = []
        values.extend(strings)
        return values

    @contextmanager
    def _measure(self, stage_name: str) -> Iterator[None]:
        """Responsibilities: _reference stage measurement_."""
        started = perf_counter()
        try:
            yield
        finally:
            timings = self._tree.timings_data()
            timings[stage_name] = (perf_counter() - started) * 1000

    def _main_guard_node(self, node: ast.AST) -> bool:
        """Responsibilities: _main guard node classification_."""
        if type(node) is not ast.If:
            return False
        test = node.test
        if type(test) is not ast.Compare or len(test.ops) != 1:
            return False
        if type(test.ops[0]) is not ast.Eq or len(test.comparators) != 1:
            return False
        if type(test.left) is not ast.Name or test.left.id != PYTHON_MAIN_NAME:
            return False
        comparator = test.comparators[0]
        return type(comparator) is ast.Constant and comparator.value == PYTHON_MAIN_VALUE

    def _module_reference_data(self) -> JsonObject:
        """Responsibilities: _module reference metadata_."""
        with self._measure("python-imports"):
            imports = self._tree.analysis_state().core().source_dependencies().import_nodes().import_records()
        with self._measure("python-exports"):
            exports = self._ast_metadata.export_names()
        with self._measure("main-guard"):
            main_guard = any(self._main_guard_node(node) for node in self._tree.tree().body)
        return {
            "python_imports": self._json_records(imports),
            "python_exports": self._json_strings(exports),
            "python_main_guard": main_guard,
        }

    def _symbol_reference_data(self) -> JsonObject:
        """Responsibilities: _symbol reference metadata_."""
        with self._measure("reference-aliases"):
            tree = self._tree.tree()
            aliases = (
                self._tree.analysis_state()
                .imports()
                .reference_aliases()
                .collect(
                    tree,
                    self._tree.analysis_state().core().source_dependencies().node_index().nodes(tree),
                )
            )
        with self._measure("symbol-references"):
            references = self.symbol_references()
        return {
            "reference_aliases": self._json_records(aliases),
            "symbol_references": self._json_records(references),
        }

    def _reference_data(
        self,
        literals: LiteralMetadata,
        call_references: list[JsonObject],
    ) -> JsonObject:
        """Responsibilities: _runtime reference content_."""
        reference_data = self._module_reference_data()
        reference_data.update(self._symbol_reference_data())
        reference_data.update(
            {
                "call_references": self._json_records(call_references),
                "literal_references": self._json_records(literals[AST_REFERENCES_KEY]),
                "literal_constants": self._json_records(literals["constants"]),
            },
        )
        return reference_data

    def _metadata_data(self) -> JsonObject:
        """Responsibilities: _reference metadata content_."""
        with self._measure("docstring-spans"):
            docstring_spans = self._ast_metadata.docstring_locations()
        with self._measure("responsibility-targets"):
            responsibility_targets = self._responsibility_target_collector.collect()
        return {
            "docstring_spans": self._json_records(docstring_spans),
            "responsibility_targets": self._json_records(responsibility_targets),
        }

    def __init__(
        self,
        tree: PythonAstContentTreeViewContract,
        ast_metadata: PythonAstMetadataContract,
        literal_metadata: PythonLiteralMetadataContract,
        responsibility_target_collector: PythonResponsibilityTargetsContract,
    ) -> None:
        """Responsibilities: _reference content initialization_."""
        self._tree: PythonAstContentTreeViewContract = tree
        self._ast_metadata: PythonAstMetadataContract = ast_metadata
        self._literal_metadata: PythonLiteralMetadataContract = literal_metadata
        self._responsibility_target_collector: PythonResponsibilityTargetsContract = responsibility_target_collector

    def symbol_references(self) -> list[JsonObject]:
        """Responsibilities: _named symbol usage collection_."""
        references: list[JsonObject] = []
        for node in self._tree.analysis_state().core().source_dependencies().node_index().nodes(self._tree.tree()):
            if type(node) is ast.Name and type(node.ctx) is ast.Load:
                references.append({"name": node.id, "line": node.lineno - 1})
            if type(node) is ast.Attribute:
                references.append({"name": node.attr, "line": node.lineno - 1})
        return references

    def collect(self) -> JsonObject:
        """Responsibilities: _reference content collection_."""
        with self._measure("literal-metadata"):
            literals = self._literal_metadata.collect()
        with self._measure("call-references"):
            call_references = self._tree.analysis_state().imports().references().collect_references()
        self._tree.timings_data().update(self._tree.analysis_state().imports().references().timings_data())
        reference_data = self._reference_data(literals, call_references)
        metadata_data = self._metadata_data()
        with self._measure("coding-issues"):
            coding_issues = self._tree.coding_issues()
        return {
            **reference_data,
            **metadata_data,
            "coding_issues": self._json_records(coding_issues),
        }
