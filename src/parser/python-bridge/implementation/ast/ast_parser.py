from __future__ import annotations


from typing import Any
from implementation.ast.type_declarations.annotation_resolver import AnnotationNames
from implementation.references.aliases.reference_aliases import PythonReferenceAliases
from implementation.ast.callable_statements import CallableStatements
from implementation.rules.import_rules import ImportRules
from implementation.references.call_returns import CallReturns
from implementation.references.call_return_state import PythonCallReturnState
from implementation.rules.structure_issues import StructureIssues
from implementation.ast.class_nodes.class_node_builder import (
    PythonClassNode,
    PythonClassNodeOptions,
)
from implementation.ast.callable_nodes.function_nodes import PythonFunctionNodes
from implementation.rules.coding_issue_collector import PythonCodingIssueCollector
from implementation.references.reference_collector import PythonReferenceCollector
from implementation.ast.symbol_nodes import PythonAstSymbolNodes
from implementation.ast.type_declarations.module_constant_spans import (
    PythonModuleConstantSpans,
)
from implementation.ast.node_index import PythonAstNodeIndex
from implementation.ast.source_segments import SourceSegments
from implementation.ast.ast_content import PythonAstContent
from implementation.references.aliases.container_aliases import PythonContainerAliases
from implementation.types import JsonObject
from coding_issue_timing import PythonCodingIssueTiming
import ast


class PythonAstTree:
    """Responsibilities: _Python source parsing_."""

    source: str
    tree: ast.Module
    symbols: PythonAstSymbolNodes
    module_constants: PythonModuleConstantSpans
    references: PythonReferenceCollector
    timings: dict[str, float]
    content_collector: PythonAstContent

    def _class_node(
        self, node: ast.ClassDef, container_aliases: PythonContainerAliases
    ) -> JsonObject:
        """Responsibilities: _class node construction_."""
        builder: Any = PythonClassNode(
            PythonClassNodeOptions(
                node,
                self.source,
                self.node_index,
                self.source_segments,
                container_aliases,
            )
        )
        return builder.result

    def _class_nodes(self) -> list[JsonObject]:
        """Responsibilities: _construction normalization class nodes_."""
        nodes: Any = [
            node
            for node in self.node_index.nodes(self.tree)
            if type(node) is ast.ClassDef
        ]
        container_aliases = PythonContainerAliases()
        for statement in self.tree.body:
            container_aliases.observe(statement)
        return [self._class_node(node, container_aliases) for node in nodes]

    def _from_import_node(self, node: ast.ImportFrom) -> JsonObject:
        """Responsibilities: _normalization from-import statement its_."""
        names: list[dict[str, str]] = []
        for item in node.names:
            name: Any = {"name": item.name}
            if item.asname:
                name["alias"] = item.asname
            names.append(name)
        module_prefix = "." * node.level
        module_name: Any = node.module
        if module_name is None:
            module_name = ""
        return {
            "line": node.lineno - 1,
            "module": module_prefix + module_name,
            "names": names,
        }

    def _import_nodes(self) -> list[JsonObject]:
        """Responsibilities: _collection normalization import records_."""
        imports: list[JsonObject] = []
        for node in self.node_index.nodes(self.tree):
            if type(node) is ast.ImportFrom:
                imports.append(self._from_import_node(node))
                continue
            if type(node) is not ast.Import:
                continue
            for item in node.names:
                name: Any = {"name": item.name}
                if item.asname:
                    name["alias"] = item.asname
                imports.append(
                    {"line": node.lineno - 1, "module": item.name, "names": [name]}
                )
        return imports

    def _main_guard_present(self) -> bool:
        """Responsibilities: _detection standard Python main_."""
        for node in self.tree.body:
            if type(node) is not ast.If:
                continue
            test: Any = node.test
            if type(test) is not ast.Compare or len(test.ops) != 1:
                continue
            if type(test.ops[0]) is not ast.Eq or len(test.comparators) != 1:
                continue
            if type(test.left) is not ast.Name or test.left.id != "__name__":
                continue
            comparator: Any = test.comparators[0]
            if type(comparator) is ast.Constant and comparator.value == "__main__":
                return True
        return False

    def _docstring_span(self, value: ast.Constant) -> dict[str, int]:
        """Responsibilities: _docstring AST value conversion_."""
        end_line: Any = value.end_lineno
        if end_line is None:
            end_line: Any = value.lineno
        end_column: Any = value.end_col_offset
        if end_column is None:
            end_column: Any = value.col_offset
        return {
            "start_line": value.lineno - 1,
            "start_column": value.col_offset,
            "end_line": end_line - 1,
            "end_column": end_column,
        }

    def _docstring_spans(self) -> list[JsonObject]:
        """Responsibilities: _collection source spans module_."""
        spans: list[dict[str, int]] = []
        owners: Any = (ast.Module, ast.ClassDef, ast.FunctionDef, ast.AsyncFunctionDef)
        for node in self.node_index.nodes(self.tree):
            if type(node) not in owners:
                continue
            body: Any = node.body
            if not body:
                continue
            if not self.callable_statements.string_statement(body[0]):
                continue
            spans.append(self._docstring_span(body[0].value))
        return spans

    def __init__(self, source: str) -> None:
        """Responsibilities: _reusable source initialization_."""
        self.source: Any = source
        self.timings: dict[str, float] = {}
        self.tree: Any = ast.parse(source)
        self.node_index: Any = PythonAstNodeIndex()
        self.source_segments: Any = SourceSegments(source)
        self.function_nodes: PythonFunctionNodes = PythonFunctionNodes(
            self.tree, self.node_index, self.source_segments
        )
        self.symbols: Any = PythonAstSymbolNodes(self.tree, self.node_index)
        self.module_constants: Any = PythonModuleConstantSpans(self.tree)
        self.callable_statements: Any = CallableStatements()
        self.import_rules: Any = ImportRules()
        self.structure_issues: Any = StructureIssues(self.node_index)
        self.reference_aliases: PythonReferenceAliases = PythonReferenceAliases()
        call_return_state = PythonCallReturnState()
        self.references: Any = PythonReferenceCollector(
            self.tree,
            CallReturns(AnnotationNames(), call_return_state),
            self.node_index,
            call_return_state,
        )

        self.content_collector: PythonAstContent = PythonAstContent(self)

    def coding_issues(self) -> list[JsonObject]:
        """Responsibilities: _collection Python coding issues_."""
        collector: PythonCodingIssueCollector = PythonCodingIssueCollector(
            self.tree, self.source, self.node_index
        )
        issues: Any = collector.collect()
        timing: PythonCodingIssueTiming = collector.timing
        for name, duration_ms in timing.durations().items():
            self.timings[f"coding-issues.{name}"] = duration_ms
        return issues

    def timings_data(self) -> dict[str, float]:
        """Responsibilities: _AST stage timing access_."""
        return self.timings

    def ast(self) -> JsonObject:
        """Responsibilities: _combination normalization AST content_."""
        content: JsonObject = self.content_collector.collect()
        return {
            "language": "python",
            **content,
        }
