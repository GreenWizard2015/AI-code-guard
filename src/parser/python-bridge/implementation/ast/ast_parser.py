from __future__ import annotations


from typing import Any
from implementation.ast.annotation_resolver import AnnotationNames
from implementation.ast.callable_arguments import CallableArguments
from implementation.ast.callable_metrics import CallableMetrics
from implementation.ast.callable_statements import CallableStatements
from implementation.rules.import_rules import ImportRules
from implementation.references.call_returns import CallReturns
from implementation.rules.structure_issues import StructureIssues
from implementation.ast.class_node_builder import PythonClassNode
from implementation.ast.callable_node_builder import PythonCallableNode
from implementation.rules.coding_issue_collector import PythonCodingIssueCollector
from implementation.rules.private_access_collector import PythonPrivateAccessCollector
from implementation.references.reference_collector import PythonReferenceCollector
from implementation.ast.symbol_nodes import PythonAstSymbolNodes
from implementation.ast.module_constant_spans import PythonModuleConstantSpans
from implementation.ast.responsibility_targets import PythonResponsibilityTargets
from implementation.ast.node_index import PythonAstNodeIndex
from implementation.ast.source_segments import SourceSegments
from implementation.types import JsonObject
import ast


class PythonAstTree:
    """Responsibilities: _Python source parsing_."""

    source: str
    tree: ast.Module
    symbols: PythonAstSymbolNodes
    module_constants: PythonModuleConstantSpans
    references: PythonReferenceCollector

    def _class_nodes(self) -> list[JsonObject]:
        """Responsibilities: _construction normalization class nodes_."""
        nodes: Any = [node for node in self.tree.body if type(node) is ast.ClassDef]
        results: Any = []
        for node in nodes:
            builder: Any = PythonClassNode(
                node, self.source, self.node_index, self.source_segments
            )
            results.append(builder.result)
        return results

    def _function_nodes(self) -> list[JsonObject]:
        """Responsibilities: _construction normalization callable nodes_."""
        results: Any = []
        callable_arguments: Any = CallableArguments(self.node_index)
        callable_metrics: Any = CallableMetrics()
        callable_statements: Any = CallableStatements()
        for node in self.tree.body:
            if type(node) in (ast.FunctionDef, ast.AsyncFunctionDef):
                builder: Any = PythonCallableNode(
                    node, self.node_index, self.source_segments
                )
                results.append(
                    builder.result(
                        callable_statements, callable_arguments, callable_metrics
                    )
                )
        return results

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

    def _has_main_guard(self) -> bool:
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

    def _reference_aliases(self) -> list[dict[str, str]]:
        """Responsibilities: _collection aliases introduced import_."""
        aliases: list[dict[str, str]] = []
        for node in self.tree.body:
            if type(node) not in (ast.Import, ast.ImportFrom):
                continue
            for item in node.names:
                if item.asname:
                    aliases.append({"name": item.asname, "target": item.name})
        return aliases

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

    def _docstring_spans(self) -> list[dict[str, int]]:
        """Responsibilities: _collection source spans module_."""
        spans: list[dict[str, int]] = []
        owners: Any = (ast.Module, ast.ClassDef, ast.FunctionDef, ast.AsyncFunctionDef)
        for node in self.node_index.nodes(self.tree):
            if type(node) not in owners:
                continue
            body: Any = node.body
            if not body or not self.callable_statements.string_statement(body[0]):
                continue
            spans.append(self._docstring_span(body[0].value))
        return spans

    def __init__(self, source: str) -> None:
        """Responsibilities: _reusable source initialization_."""
        self.source: Any = source
        self.tree: Any = ast.parse(source)
        self.node_index: Any = PythonAstNodeIndex()
        self.source_segments: Any = SourceSegments(source)
        self.symbols: Any = PythonAstSymbolNodes(self.tree, self.node_index)
        self.module_constants: Any = PythonModuleConstantSpans(self.tree)
        self.callable_statements: Any = CallableStatements()
        self.import_rules: Any = ImportRules()
        self.structure_issues: Any = StructureIssues(self.node_index)
        self.references: Any = PythonReferenceCollector(
            self.tree,
            CallReturns(AnnotationNames()),
            node_index=self.node_index,
        )

    def ast_content(self) -> JsonObject:
        """Responsibilities: _normalization classes callables assembly_."""
        private_access: Any = PythonPrivateAccessCollector(self.tree, self.node_index)
        private_members: Any = private_access.member_names()
        responsibility_targets = PythonResponsibilityTargets(self.tree)
        return {
            "classes": self._class_nodes(),
            "functions": self._function_nodes(),
            "parse_issues": [],
            "import_issues": self.import_rules.import_issues(self.tree),
            "attribute_accesses": self.structure_issues.deep_attribute_accesses(
                self.tree
            ),
            "private_accesses": private_access.accesses(private_members),
            "repeated_branches": self.structure_issues.repeated_branches(self.tree),
            "call_references": self.references.collect_references(),
            "python_imports": self._import_nodes(),
            "python_main_guard": self._has_main_guard(),
            "reference_aliases": self._reference_aliases(),
            "docstring_spans": self._docstring_spans(),
            "responsibility_targets": responsibility_targets.collect(),
            "coding_issues": self.coding_issues(),
        }

    def coding_issues(self) -> list[JsonObject]:
        """Responsibilities: _collection Python coding issues_."""
        collector: Any = PythonCodingIssueCollector(
            self.tree, self.source, self.node_index
        )
        issues: Any = collector.collect()
        return issues

    def ast(self) -> JsonObject:
        """Responsibilities: _combination normalization AST content_."""
        content: Any = self.ast_content()
        content.update(
            {
                "named_symbols": self.symbols.named_symbols,
                "type_declarations": self.symbols.type_declarations,
                "module_instances": self.symbols.module_instances,
                "module_constant_spans": self.module_constants.collect_spans(),
                "module_type_spans": self.module_constants.collect_types(),
                "module_protocol_spans": self.module_constants.collect_protocols(),
            }
        )
        return {
            "language": "python",
            **content,
        }
