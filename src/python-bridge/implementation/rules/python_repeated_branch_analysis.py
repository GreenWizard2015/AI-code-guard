from __future__ import annotations

import ast

from implementation.rules.branch_summary import BranchSummary
from implementation.rules.protocols import BranchSummaryContract
from implementation.types import JsonObject


class PythonRepeatedBranchAnalysis:
    """Responsibilities: _branch-chain analysis_, _repeated branch diagnostics_."""

    _nodes: list[ast.AST]

    def _comparison_name(self, comparison: ast.AST) -> str:
        """Responsibilities: _normalization comparison expression branch_."""
        match comparison:
            case ast.Compare() as expression:
                pass
            case _:
                return ""
        if not self._simple_comparison(expression):
            return ""
        operands: list[ast.expr] = [expression.left, expression.comparators[0]]
        names: list[str] = []
        for operand in operands:
            match operand:
                case ast.Name(id=name):
                    names.append(name)
        if len(names) != 1:
            return ""
        return names[0]

    def _simple_comparison(self, comparison: ast.Compare) -> bool:
        """Responsibilities: _classification simple equality comparison_."""
        if len(comparison.ops) != 1:
            return False
        if type(comparison.ops[0]) is not ast.Eq:
            return False
        return len(comparison.comparators) == 1

    def _continuation_ids(self) -> set[int]:
        """Responsibilities: _branch-chain continuation identification_."""
        continuation_ids: set[int] = set()
        for node in self._nodes:
            if type(node) is not ast.If:
                continue
            if len(node.orelse) != 1:
                continue
            if type(node.orelse[0]) is ast.If:
                continuation_ids.add(id(node.orelse[0]))
        return continuation_ids

    def _branch_starts(self) -> list[ast.If]:
        """Responsibilities: _branch-chain start collection_."""
        continuation_ids = self._continuation_ids()
        starts: list[ast.If] = []
        for node in self._nodes:
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
        self,
        branch_chain: dict[int, str],
    ) -> dict[int, BranchSummaryContract]:
        """Responsibilities: _branch-chain summary construction_."""
        branch_ids = list(branch_chain)
        branch_names = list(branch_chain.values())
        summaries: dict[int, BranchSummaryContract] = {}
        summary: BranchSummaryContract = BranchSummary()
        for index in range(len(branch_ids) - 1, -1, -1):
            summary = summary.prepend(branch_names[index])
            summaries[branch_ids[index]] = summary
        return summaries

    def __init__(self, indexed_nodes: list[ast.AST]) -> None:
        """Responsibilities: _indexed syntax branches_."""
        self._nodes = indexed_nodes

    def branch_summaries(self) -> dict[int, BranchSummaryContract]:
        """Responsibilities: _single-pass branch-chain summary collection_."""
        summaries: dict[int, BranchSummaryContract] = {}
        for start in self._branch_starts():
            summaries.update(self._summarize_chain(self._branch_chain(start)))
        return summaries

    def repeated_results(
        self,
        summaries: dict[int, BranchSummaryContract],
    ) -> list[JsonObject]:
        """Responsibilities: _repeated branch diagnostic collection_."""
        result: list[JsonObject] = []
        for node in self._nodes:
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
