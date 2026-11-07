from __future__ import annotations

import ast

from implementation.ast.callables.python_ast_coding_issue_runner import (
    PythonAstCodingIssueInputs,
    PythonAstCodingIssues,
)
from implementation.ast.callables.python_ast_tree_dependencies import (
    PythonAstTreeDependencies,
)
from implementation.ast.class_nodes.python_class_method_node import (
    PythonClassNodeOptions,
)
from implementation.ast.class_nodes.python_class_node import (
    PythonClassNode,
)
from implementation.ast.imports.python_ast_core_dependencies import (
    PythonAstCoreDependencies,
)
from implementation.ast.protocols import (
    PythonAstContentCollectorContract,
    PythonAstCoreDependenciesContract,
    PythonAstNodeIndexContract,
    PythonAstTreeStateContract,
    PythonSourceSegmentsContract,
)
from implementation.ast.python_ast_content import PythonAstContent
from implementation.ast.python_ast_tree_assembler import PythonAstTreeAssembler
from implementation.references.protocols import (
    PythonContainerAliasesContract,
    PythonScopedTypeAliasesContract,
)
from implementation.types import JsonObject


class PythonAstTree:
    """Responsibilities: _Python syntax tree_, _AST hierarchy_."""

    _source: str
    _tree: ast.Module
    _source_segments: PythonSourceSegmentsContract
    _container_aliases: PythonContainerAliasesContract
    _type_aliases: PythonScopedTypeAliasesContract
    _tree_state: PythonAstTreeStateContract
    _timings: dict[str, float]
    _content_collector: PythonAstContentCollectorContract

    def _class_node(
        self,
        node: ast.ClassDef,
        node_index: PythonAstNodeIndexContract,
        container_aliases: PythonContainerAliasesContract,
    ) -> JsonObject:
        """Responsibilities: _class node construction_."""
        builder = PythonClassNode(
            PythonClassNodeOptions(
                node,
                self._source,
                node_index,
                self._source_segments,
                container_aliases,
                self._type_aliases,
                self._tree.body,
            ),
        )
        return builder.result

    def __init__(self, source: str) -> None:
        """Responsibilities: _reusable source initialization_."""
        core_dependencies: PythonAstCoreDependenciesContract = PythonAstCoreDependencies(source)
        tree_dependencies = PythonAstTreeDependencies(
            core_dependencies.syntax_tree(),
            core_dependencies.node_index(),
        )
        type_aliases = tree_dependencies.type_aliases()
        callable_statements = tree_dependencies.callable_statements()
        assembler = PythonAstTreeAssembler(
            core_dependencies,
            type_aliases,
            callable_statements,
        )
        core_state = assembler.core_state()
        state = assembler.state(core_state, tree_dependencies)
        core = state.core()
        callables = state.callables()
        callable_statements = callables.callable_statements()
        self._timings: dict[str, float] = {}
        source_dependencies = core.source_dependencies()
        self._source: str = source
        self._tree: ast.Module = source_dependencies.syntax_tree()
        self._source_segments: PythonSourceSegmentsContract = source_dependencies.source_segments()
        self._container_aliases: PythonContainerAliasesContract = core.container_aliases()
        self._type_aliases: PythonScopedTypeAliasesContract = type_aliases
        self._tree_state = state
        self._content_collector: PythonAstContentCollectorContract = PythonAstContent(
            self,
        )

    def tree(self) -> ast.Module:
        """Responsibilities: _Python AST access_."""
        return self._tree

    def class_nodes(self) -> list[JsonObject]:
        """Responsibilities: _class node collection_."""
        node_index = self._tree_state.core().source_dependencies().node_index()
        nodes = node_index.class_definitions(self._tree)
        container_aliases = self._container_aliases
        for statement in self._tree.body:
            container_aliases.observe(statement)
        return [self._class_node(node, node_index, container_aliases) for node in nodes]

    def coding_issues(self) -> list[JsonObject]:
        """Responsibilities: _collection Python coding issues_."""
        runner = PythonAstCodingIssues(
            PythonAstCodingIssueInputs(
                self._tree,
                self._source,
                self._tree_state.core().source_dependencies().node_index(),
                self._source_segments,
                self._container_aliases,
                self._tree_state.core().container_values(),
                self._tree_state.core().container_keys(),
                self._type_aliases,
                self._tree_state.imports().reference_aliases(),
            ),
        )
        issues = runner.issues()
        for name, duration_ms in runner.timings_data().items():
            self._timings.update({f"coding-issues.{name}": duration_ms})
        return issues

    def timings_data(self) -> dict[str, float]:
        """Responsibilities: _AST stage timing access_."""
        return self._timings

    def ast(self) -> JsonObject:
        """Responsibilities: _combination normalization AST content_."""
        content: JsonObject = self._content_collector.collect()
        return {
            "language": "python",
            "type_members": {},
            **content,
        }

    def analysis_state(self) -> PythonAstTreeStateContract:
        """Responsibilities: _AST analysis state groups_."""
        return self._tree_state
