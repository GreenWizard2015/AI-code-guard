from __future__ import annotations

import ast

from implementation.ast.imports.python_import_nodes import PythonImportNodes
from implementation.ast.imports.python_ast_node_index import PythonAstNodeIndex
from implementation.ast.imports.source_segments import SourceSegments
from implementation.ast.protocols import (
    PythonAstNodeIndexContract,
    PythonSourceSegmentsContract,
    PythonStructureIssuesContract,
)
from protocols import PythonImportNodesContract
from implementation.rules.structure_issues import StructureIssues


class PythonAstCoreDependencies:
    """Responsibilities: _core AST service construction_, _dependency access_."""

    _tree: ast.Module
    _node_index: PythonAstNodeIndexContract
    _import_nodes: PythonImportNodesContract
    _source_segments: PythonSourceSegmentsContract
    _structure_issues: PythonStructureIssuesContract

    def __init__(self, source: str) -> None:
        """Responsibilities: _core AST dependency initialization_."""
        self._tree: ast.Module = ast.parse(source)
        self._node_index: PythonAstNodeIndexContract = PythonAstNodeIndex()
        self._import_nodes: PythonImportNodesContract = PythonImportNodes(
            self._tree, self._node_index
        )
        self._source_segments: PythonSourceSegmentsContract = SourceSegments(source)
        self._structure_issues: PythonStructureIssuesContract = StructureIssues(
            self._node_index
        )

    def syntax_tree(self) -> ast.Module:
        """Responsibilities: _syntax tree access_."""
        return self._tree

    def node_index(self) -> PythonAstNodeIndexContract:
        """Responsibilities: _node index access_."""
        return self._node_index

    def import_nodes(self) -> PythonImportNodesContract:
        """Responsibilities: _import node access_."""
        return self._import_nodes

    def source_segments(self) -> PythonSourceSegmentsContract:
        """Responsibilities: _source segment access_."""
        return self._source_segments

    def structure_issues(self) -> PythonStructureIssuesContract:
        """Responsibilities: _structure issue access_."""
        return self._structure_issues
