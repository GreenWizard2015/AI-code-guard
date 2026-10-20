from __future__ import annotations

import ast

from implementation.ast.protocols import PythonAstNodeIndexContract
from implementation.references.protocols import PythonReferenceAliasesContract


class PythonTemporaryResultAccess:
    """Responsibilities: _temporary receiver_, _member access policy_."""

    def _receiver(self, target: ast.AST) -> ast.AST:
        """Responsibilities: _temporary access receiver resolution_."""
        while type(target) in (ast.Attribute, ast.Subscript):
            target = target.value
        return target

    def _call_index(self, node: ast.Subscript) -> bool:
        """Responsibilities: _function result indexing_."""
        receiver = node.value
        while type(receiver) is ast.Attribute:
            receiver = receiver.value
        if type(receiver) is ast.Subscript:
            return False
        if type(receiver) is not ast.Call:
            return False
        name = ast.unparse(receiver.func)
        if self.reference_aliases.target_is_class(name):
            return False
        return True

    def _literal_access(self, node: ast.AST) -> bool:
        """Responsibilities: _spread literal access_."""
        if type(node) not in (ast.Attribute, ast.Subscript):
            return False
        parents = self.node_index.parents(node)
        if parents:
            parent = parents[0]
            if type(parent) in (ast.Attribute, ast.Subscript) and parent.value is node:
                return False
            if type(parent) is ast.Call and parent.func is node:
                return False
        return self._spread_literal_result(node.value)

    def _spread_literal_result(self, target: ast.AST) -> bool:
        """Responsibilities: _temporary spread-container detection_."""
        receiver = self._receiver(target)
        if type(receiver) is ast.List:
            return any(type(element) is ast.Starred for element in receiver.elts)
        if type(receiver) is ast.Dict:
            return any(key is None for key in receiver.keys)
        return False

    def _constructor_access(self, node: ast.AST) -> bool:
        """Responsibilities: _constructor member access_."""
        if type(node) not in (ast.Attribute, ast.Subscript):
            return False
        parents = self.node_index.parents(node)
        if parents:
            parent = parents[0]
            if type(parent) in (ast.Attribute, ast.Subscript):
                if parent.value is node:
                    return False
            if type(parent) is ast.Call:
                if parent.func is node:
                    return False
        return self.constructor_result(node.value)

    def __init__(
        self,
        reference_aliases: PythonReferenceAliasesContract,
        node_index: PythonAstNodeIndexContract,
    ) -> None:
        """Responsibilities: _temporary access policy initialization_."""
        self.reference_aliases: PythonReferenceAliasesContract = reference_aliases
        self.node_index: PythonAstNodeIndexContract = node_index

    def constructor_result(self, target: ast.AST) -> bool:
        """Responsibilities: _constructor result detection_."""
        receiver = self._receiver(target)
        if type(receiver) is not ast.Call:
            return False
        name = ast.unparse(receiver.func)
        return self.reference_aliases.target_is_class(name)

    def violates(self, node: ast.AST) -> bool:
        """Responsibilities: _temporary result rule decision_."""
        if type(node) is ast.Call:
            if type(node.func) not in (ast.Attribute, ast.Subscript):
                return False
            if self.constructor_result(node.func.value):
                return True
            return self._spread_literal_result(node.func.value)
        if type(node) is ast.Subscript:
            if self._call_index(node):
                return True
        if self._literal_access(node):
            return True
        return self._constructor_access(node)
