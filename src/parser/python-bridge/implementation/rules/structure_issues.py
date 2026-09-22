from __future__ import annotations


import ast
from typing import Any, Optional
from implementation.ast.protocols import PythonAstNodeIndexProtocol


class StructureIssues:
    """Responsibilities: _detection Python attribute-depth repeated-branch_."""

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
            for child in ast.iter_child_nodes(parent):
                if type(child) is ast.Attribute:
                    result.add(id(child))
        return result

    def _comparison_name(self, node: ast.AST) -> str:
        """Responsibilities: _normalization comparison expression branch_."""
        is_comparison = type(node) is ast.Compare
        if not is_comparison or len(node.ops) != 1:
            return ""
        is_name_comparison = type(node.ops[0]) is ast.Eq
        if not is_name_comparison or type(node.left) is not ast.Name:
            return ""
        if len(node.comparators) != 1:
            return ""
        return node.left.id

    def _branch_chain(self, node: ast.If) -> list[str]:
        """Responsibilities: _condition normalization_."""
        names: list[str] = []
        current: Optional[ast.If] = node
        while current is not None:
            name: Any = self._comparison_name(current.test)
            if not name:
                break
            names.append(name)
            current: Any = None
            if len(node.orelse) == 1 and type(node.orelse[0]) is ast.If:
                current: Any = node.orelse[0]
                node: Any = current
        return names

    def __init__(self, node_index: PythonAstNodeIndexProtocol) -> None:
        """Responsibilities: _initialization reusable AST node_."""
        self.node_index: Any = node_index
        self.max_attribute_depth: Any = 4

    def repeated_branches(self, tree: ast.Module) -> list[dict[str, int]]:
        """Responsibilities: _reporting repeated branch conditions_."""
        result: list[dict[str, int]] = []
        for node in self.node_index.nodes(tree):
            if type(node) is not ast.If:
                continue
            chain: Any = self._branch_chain(node)
            has_repeated_name = len(chain) >= 2
            if has_repeated_name and len(set(chain)) == 1:
                result.append({"line": node.lineno - 1})
        return result

    def deep_attribute_accesses(self, tree: ast.Module) -> list[dict[str, int]]:
        """Responsibilities: _reporting attribute chains exceeding_."""
        nested: Any = self._nested_attributes(tree)
        accesses: list[dict[str, int]] = []
        for node in self.node_index.nodes(tree):
            is_nested_attribute = type(node) is ast.Attribute
            if not is_nested_attribute or id(node) in nested:
                continue
            depth: Any = self._attribute_depth(node)
            if depth > self.max_attribute_depth:
                accesses.append({"line": node.lineno - 1, "depth": depth})
        return accesses
