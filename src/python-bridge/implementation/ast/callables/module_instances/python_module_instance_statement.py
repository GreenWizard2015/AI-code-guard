from __future__ import annotations

import ast

from implementation.references.protocols import PythonReferenceAliasesContract
from implementation.rules.constants import PYTHON_MAIN_NAME, PYTHON_MAIN_VALUE


class PythonModuleInstanceStatement:
    """Responsibilities: _module statement analysis_, _assignment extraction_."""

    def __init__(self, node: ast.AST) -> None:
        """Responsibilities: _module statement initialization_."""
        self._node: ast.AST = node

    def node(self) -> ast.AST:
        """Responsibilities: _module statement node access_."""
        return self._node

    def main_guard(self) -> bool:
        """Responsibilities: _main guard classification_."""
        node = self._node
        if type(node) is not ast.If or type(node.test) is not ast.Compare:
            return False
        if len(node.test.ops) != 1 or type(node.test.ops[0]) is not ast.Eq:
            return False
        if type(node.test.left) is not ast.Name or node.test.left.id != PYTHON_MAIN_NAME:
            return False
        if len(node.test.comparators) != 1:
            return False
        comparator = node.test.comparators[0]
        return type(comparator) is ast.Constant and comparator.value == PYTHON_MAIN_VALUE

    def assignment_target_values(
        self,
        reference_aliases: PythonReferenceAliasesContract,
    ) -> dict[str, ast.AST]:
        """Responsibilities: _assignment target value extraction_."""
        node = self._node
        if type(node) is ast.Assign and len(node.targets) == 1:
            return reference_aliases.target_values(node.targets[0], node.value)
        if type(node) is ast.AnnAssign and node.value is not None:
            return reference_aliases.target_values(node.target, node.value)
        return {}

    def assignment_value(self) -> ast.expr:
        """Responsibilities: _assignment value identification_."""
        node = self._node
        if type(node) is ast.Assign:
            return node.value
        if type(node) is ast.AnnAssign and node.value is not None:
            return node.value
        return ast.Constant(value=None)
