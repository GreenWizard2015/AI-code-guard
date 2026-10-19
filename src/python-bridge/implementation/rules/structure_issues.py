from __future__ import annotations

import ast
from typing import Any

from implementation.protocols import PythonAstNodeIndexContract
from implementation.types import JsonObject
from implementation.rules.branch_summary import BranchSummary
from implementation.rules.protocols import BranchSummaryContract


class StructureIssues:
    """Responsibilities: _attribute depth diagnostics_, _repeated branch diagnostics_."""

    def _attribute_depth(self, node: ast.Attribute) -> int:
        """Responsibilities: _calculation nested attribute depth_."""
        depth, value = 1, node.value
        while type(value) is ast.Attribute:
            depth, value = depth + 1, value.value
        return depth + 1

    def _nested_attributes(self, tree: ast.Module) -> set[int]:
        """Responsibilities: _collection source lines containing_."""
        result: set[int] = set()
        for parent in self.node_index.nodes(tree):
            if type(parent) is not ast.Attribute:
                continue
            for child in self.node_index.children(parent):
                if type(child) is ast.Attribute:
                    result.add(id(child))
        return result

    def _comparison_name(self, node: ast.AST) -> str:
        """Responsibilities: _normalization comparison expression branch_."""
        if not self._simple_comparison(node):
            return ""
        operands: list[ast.AST] = [node.left, node.comparators[0]]
        names = [operand.id for operand in operands if type(operand) is ast.Name]
        if len(names) != 1:
            return ""
        return names[0]

    def _simple_comparison(self, node: ast.AST) -> bool:
        """Responsibilities: _classification simple equality comparison_."""
        if type(node) is not ast.Compare:
            return False
        if len(node.ops) != 1:
            return False
        if type(node.ops[0]) is not ast.Eq:
            return False
        return len(node.comparators) == 1

    def _continuation_ids(self, nodes: list[ast.AST]) -> set[int]:
        """Responsibilities: _branch-chain continuation identification_."""
        continuation_ids: set[int] = set()
        for node in nodes:
            if type(node) is not ast.If:
                continue
            if len(node.orelse) != 1:
                continue
            if type(node.orelse[0]) is ast.If:
                continuation_ids.add(id(node.orelse[0]))
        return continuation_ids

    def _branch_starts(self, nodes: list[ast.AST]) -> list[ast.If]:
        """Responsibilities: _branch-chain start collection_."""
        continuation_ids = self._continuation_ids(nodes)
        starts: list[ast.If] = []
        for node in nodes:
            if type(node) is not ast.If:
                continue
            if id(node) in continuation_ids:
                continue
            starts.append(node)
        return starts

    def _branch_chain(self, start: ast.If) -> dict[int, str]:
        """Responsibilities: _branch-chain comparison collection_."""
        chain: dict[int, str] = {}
        current = start
        while True:
            name = self._comparison_name(current.test)
            if not name:
                return {}
            chain[id(current)] = name
            if len(current.orelse) != 1:
                return chain
            next_node = current.orelse[0]
            if type(next_node) is not ast.If:
                return chain
            current = next_node

    def _summarize_chain(
        self, chain: dict[int, str]
    ) -> dict[int, BranchSummaryContract]:
        """Responsibilities: _branch-chain summary construction_."""
        branch_ids = list(chain)
        branch_names = list(chain.values())
        summaries: dict[int, BranchSummaryContract] = {}
        summary: BranchSummaryContract = BranchSummary()
        for index in range(len(branch_ids) - 1, -1, -1):
            summary = summary.prepend(branch_names[index])
            summaries[branch_ids[index]] = summary
        return summaries

    def _branch_summaries(
        self, nodes: list[ast.AST]
    ) -> dict[int, BranchSummaryContract]:
        """Responsibilities: _single-pass branch-chain summary collection_."""
        summaries: dict[int, BranchSummaryContract] = {}
        for start in self._branch_starts(nodes):
            summaries.update(self._summarize_chain(self._branch_chain(start)))
        return summaries

    def _repeated_branch_results(
        self,
        nodes: list[ast.AST],
        summaries: dict[int, BranchSummaryContract],
    ) -> list[JsonObject]:
        """Responsibilities: _repeated branch diagnostic collection_."""
        result: list[dict[str, int]] = []
        for node in nodes:
            if type(node) is not ast.If:
                continue
            summary = summaries.get(id(node))
            if summary is None:
                continue
            if summary.length() < 2:
                continue
            if not summary.all_same():
                continue
            result.append({"line": node.lineno - 1})
        return result

    def __init__(self, node_index: PythonAstNodeIndexContract) -> None:
        """Responsibilities: _initialization reusable AST node_."""
        self.node_index: Any = node_index
        self.max_attribute_depth: Any = 4

    def repeated_branches(self, tree: ast.Module) -> list[JsonObject]:
        """Responsibilities: _reporting repeated branch conditions_."""
        nodes = self.node_index.nodes(tree)
        summaries = self._branch_summaries(nodes)
        return self._repeated_branch_results(nodes, summaries)

    def deep_attribute_accesses(self, tree: ast.Module) -> list[JsonObject]:
        """Responsibilities: _reporting attribute chains exceeding_."""
        nested: Any = self._nested_attributes(tree)
        accesses: list[dict[str, int]] = []
        for node in self.node_index.nodes(tree):
            is_nested_attribute = type(node) is ast.Attribute
            if not is_nested_attribute:
                continue
            if id(node) in nested:
                continue
            depth: Any = self._attribute_depth(node)
            if depth > self.max_attribute_depth:
                accesses.append({"line": node.lineno - 1, "depth": depth})
        return accesses
