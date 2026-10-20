from __future__ import annotations

import ast
from typing import Any

from implementation.ast.callables.python_ast_coding_issue_runner import (
    PythonAstCodingIssueInputs,
    PythonAstCodingIssues,
)
from implementation.ast.class_nodes.class_node_builder import (
    PythonClassNode,
    PythonClassNodeOptions,
)
from implementation.ast.protocols import (
    PythonAstCoreDependenciesContract,
)
from implementation.ast.callables.python_ast_tree_dependencies import (
    PythonAstTreeDependencies,
)
from implementation.ast.imports.python_ast_core_dependencies import (
    PythonAstCoreDependencies,
)
from implementation.ast.python_ast_content import PythonAstContent
from implementation.ast.python_ast_tree_assembler import PythonAstTreeAssembler
from protocols import (
    PythonAstContentContract,
    PythonReferenceCollectorContract,
)
from implementation.ast.protocols import (
    PythonAstNodeIndexContract,
    PythonAstSymbolNodesContract,
    PythonFunctionNodesContract,
    PythonModuleConstantSpansContract,
    PythonSourceSegmentsContract,
    PythonStructureIssuesContract,
)
from implementation.ast.protocols import PythonCallableStatementsContract
from protocols import (
    PythonImportNodesContract,
    PythonImportRulesContract,
)
from implementation.references.protocols import (
    PythonContainerAliasesContract,
    PythonContainerKeysContract,
    PythonContainerValuesContract,
    PythonReferenceAliasesContract,
    PythonScopedTypeAliasesContract,
)
from implementation.types import JsonObject


class PythonAstTree:
    """Responsibilities: _Python syntax tree_, _AST hierarchy_."""

    source: str
    tree: ast.Module
    node_index: PythonAstNodeIndexContract
    import_nodes: PythonImportNodesContract
    source_segments: PythonSourceSegmentsContract
    _container_aliases: PythonContainerAliasesContract
    container_values: PythonContainerValuesContract
    container_keys: PythonContainerKeysContract
    type_aliases: PythonScopedTypeAliasesContract
    function_nodes: PythonFunctionNodesContract
    symbols: PythonAstSymbolNodesContract
    module_constants: PythonModuleConstantSpansContract
    callable_statements: PythonCallableStatementsContract
    import_rules: PythonImportRulesContract
    structure_issues: PythonStructureIssuesContract
    reference_aliases: PythonReferenceAliasesContract
    references: PythonReferenceCollectorContract
    _timings: dict[str, float]
    content_collector: PythonAstContentContract

    def _class_node(
        self, node: ast.ClassDef, container_aliases: PythonContainerAliasesContract
    ) -> JsonObject:
        """Responsibilities: _class node construction_."""
        builder: Any = PythonClassNode(
            PythonClassNodeOptions(
                node,
                self.source,
                self.node_index,
                self.source_segments,
                container_aliases,
                self.type_aliases,
            )
        )
        return builder.result

    def _class_nodes(self) -> list[JsonObject]:
        """Responsibilities: _class node collection_."""
        nodes: Any = [
            node
            for node in self.node_index.nodes(self.tree)
            if type(node) is ast.ClassDef
        ]
        container_aliases = self._container_aliases
        for statement in self.tree.body:
            container_aliases.observe(statement)
        return [self._class_node(node, container_aliases) for node in nodes]

    def __init__(self, source: str) -> None:
        """Responsibilities: _reusable source initialization_."""
        core_dependencies: PythonAstCoreDependenciesContract = (
            PythonAstCoreDependencies(source)
        )
        tree_dependencies = PythonAstTreeDependencies(
            core_dependencies.syntax_tree(), core_dependencies.node_index()
        )
        type_aliases = tree_dependencies.type_aliases()
        callable_statements = tree_dependencies.callable_statements()
        assembler = PythonAstTreeAssembler(
            core_dependencies, type_aliases, callable_statements
        )
        core_state = assembler.core_state()
        state = assembler.state(core_state)
        core = state.core()
        callables = state.callables()
        imports = state.imports()
        self._timings: dict[str, float] = {}
        source_dependencies = core.source_dependencies()
        self.source: str = source
        self.tree: ast.Module = source_dependencies.syntax_tree()
        self.node_index: PythonAstNodeIndexContract = source_dependencies.node_index()
        self.import_nodes: PythonImportNodesContract = (
            source_dependencies.import_nodes()
        )
        self.source_segments: PythonSourceSegmentsContract = (
            source_dependencies.source_segments()
        )
        self._container_aliases: PythonContainerAliasesContract = (
            core.container_aliases()
        )
        self.container_values: PythonContainerValuesContract = core.container_values()
        self.container_keys: PythonContainerKeysContract = core.container_keys()
        self.type_aliases: PythonScopedTypeAliasesContract = type_aliases
        self.function_nodes: PythonFunctionNodesContract = callables.function_nodes()
        self.symbols: PythonAstSymbolNodesContract = callables.symbols()
        self.module_constants: PythonModuleConstantSpansContract = (
            tree_dependencies.module_constants()
        )
        self.callable_statements: PythonCallableStatementsContract = callable_statements
        self.import_rules: PythonImportRulesContract = imports.import_rules()
        self.structure_issues: PythonStructureIssuesContract = (
            imports.structure_issues()
        )
        self.reference_aliases: PythonReferenceAliasesContract = (
            imports.reference_aliases()
        )
        self.references: PythonReferenceCollectorContract = imports.references()
        self.content_collector: PythonAstContentContract = PythonAstContent(self)

    def coding_issues(self) -> list[JsonObject]:
        """Responsibilities: _collection Python coding issues_."""
        runner = PythonAstCodingIssues(
            PythonAstCodingIssueInputs(
                self.tree,
                self.source,
                self.node_index,
                self.source_segments,
                self._container_aliases,
                self.container_values,
                self.container_keys,
                self.type_aliases,
                self.reference_aliases,
            )
        )
        issues = runner.issues()
        for name, duration_ms in runner.timings_data().items():
            self._timings[f"coding-issues.{name}"] = duration_ms
        return issues

    def timings_data(self) -> dict[str, float]:
        """Responsibilities: _AST stage timing access_."""
        return self._timings

    def ast(self) -> JsonObject:
        """Responsibilities: _combination normalization AST content_."""
        content: JsonObject = self.content_collector.collect()
        return {
            "language": "python",
            "type_members": {},
            **content,
        }

    def container_aliases(self) -> PythonContainerAliasesContract:
        """Responsibilities: _exposure container alias state_."""
        return self._container_aliases
