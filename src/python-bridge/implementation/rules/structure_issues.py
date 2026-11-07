from __future__ import annotations

import ast

from implementation.ast.protocols import PythonAstNodeIndexContract
from implementation.rules.python_repeated_branch_analysis import (
    PythonRepeatedBranchAnalysis,
)
from implementation.types import JsonObject


class StructureIssues:
    """Responsibilities: _attribute depth diagnostics_, _repeated branch diagnostics_."""

    def _attribute_depth(self, node: ast.Attribute) -> int:
        """Responsibilities: _calculation nested attribute depth_."""
        depth, value = 1, node.value
        while type(value) is ast.Attribute:
            depth, value = depth + 1, value.value
        return depth + 1

    def _nested_attributes(self, module_nodes: list[ast.AST]) -> set[int]:
        """Responsibilities: _collection source lines containing_."""
        result: set[int] = set()
        for parent in module_nodes:
            if type(parent) is not ast.Attribute:
                continue
            for child in self._node_index.children(parent):
                if type(child) is ast.Attribute:
                    result.add(id(child))
        return result

    def __init__(self, node_index: PythonAstNodeIndexContract) -> None:
        """Responsibilities: _initialization reusable AST node_."""
        self._node_index: PythonAstNodeIndexContract = node_index
        self._max_attribute_depth: int = 4

    def repeated_branches(self, tree: ast.Module) -> list[JsonObject]:
        """Responsibilities: _reporting repeated branch conditions_."""
        indexed_nodes = self._node_index.nodes(tree)
        analysis = PythonRepeatedBranchAnalysis(indexed_nodes)
        branch_summaries = analysis.branch_summaries()
        return analysis.repeated_results(branch_summaries)

    def deep_attribute_accesses(self, tree: ast.Module) -> list[JsonObject]:
        """Responsibilities: _reporting attribute chains exceeding_."""
        nodes = self._node_index.nodes(tree)
        nested = self._nested_attributes(nodes)
        accesses: list[JsonObject] = []
        for node in nodes:
            match node:
                case ast.Attribute():
                    pass
                case _:
                    continue
            if id(node) in nested:
                continue
            depth = self._attribute_depth(node)
            if depth > self._max_attribute_depth:
                accesses.append({"line": node.lineno - 1, "depth": depth})
        return accesses
