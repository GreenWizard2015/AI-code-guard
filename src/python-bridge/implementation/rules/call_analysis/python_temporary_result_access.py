from __future__ import annotations

import ast

from implementation.ast.protocols import PythonAstNodeIndexContract
from implementation.references.protocols import PythonReferenceAliasesContract


class PythonTemporaryResultAccess:
    """Responsibilities: _temporary receiver_, _member access policy_."""

    def _receiver(self, receiver_chain: ast.AST) -> ast.AST:
        """Responsibilities: _temporary access receiver resolution_."""
        while True:
            match receiver_chain:
                case ast.Attribute(value=value) | ast.Subscript(value=value):
                    receiver_chain = value
                case _:
                    return receiver_chain

    def _index_call_name(self, receiver: ast.AST) -> str:
        """Responsibilities: _call target name_."""
        while True:
            match receiver:
                case ast.Attribute(value=value):
                    receiver = value
                case ast.Subscript():
                    return ""
                case ast.Call():
                    break
                case _:
                    return ""
        return ast.unparse(receiver.func)

    def _class_call_target(self, callable_name: str) -> bool:
        """Responsibilities: _class call target_."""
        target_name = self._reference_aliases.target_name(callable_name)
        target_parts = target_name.rsplit(".", 1)
        target_class = target_parts[-1]
        return target_class[:1].isupper()

    def _call_index(self, subscript: ast.Subscript) -> bool:
        """Responsibilities: _function result indexing_."""
        callable_name = self._index_call_name(subscript.value)
        if not callable_name:
            return False
        return not self._class_call_target(callable_name)

    def _literal_access(self, access_expression: ast.AST) -> bool:
        """Responsibilities: _spread literal access_."""
        match access_expression:
            case ast.Attribute(value=value) | ast.Subscript(value=value):
                receiver = value
            case _:
                return False
        parents = self._node_index.parents(access_expression)
        if parents:
            parent = parents[0]
            match parent:
                case ast.Attribute(value=child) | ast.Subscript(value=child):
                    if child is access_expression:
                        return False
                case ast.Call(func=function) if function is access_expression:
                    return False
        return self._spread_literal_result(receiver)

    def _spread_literal_result(self, literal_expression: ast.AST) -> bool:
        """Responsibilities: _temporary spread-container detection_."""
        receiver = self._receiver(literal_expression)
        match receiver:
            case ast.List(elts=elements):
                return any(type(element) is ast.Starred for element in elements)
            case ast.Dict(keys=keys):
                return any(key is None for key in keys)
            case _:
                return False

    def _constructor_access(self, access_expression: ast.AST) -> bool:
        """Responsibilities: _constructor member access_."""
        match access_expression:
            case ast.Attribute(value=value) | ast.Subscript(value=value):
                receiver = value
            case _:
                return False
        parents = self._node_index.parents(access_expression)
        if parents:
            parent = parents[0]
            match parent:
                case ast.Attribute(value=child) | ast.Subscript(value=child):
                    if child is access_expression:
                        return False
                case ast.Call(func=function):
                    if function is access_expression:
                        return False
        return self.constructor_result(receiver)

    def __init__(
        self,
        reference_aliases: PythonReferenceAliasesContract,
        node_index: PythonAstNodeIndexContract,
    ) -> None:
        """Responsibilities: _temporary access policy initialization_."""
        self._reference_aliases: PythonReferenceAliasesContract = reference_aliases
        self._node_index: PythonAstNodeIndexContract = node_index

    def constructor_result(self, constructor_expression: ast.AST) -> bool:
        """Responsibilities: _constructor result detection_."""
        receiver = self._receiver(constructor_expression)
        match receiver:
            case ast.Call(func=function):
                pass
            case _:
                return False
        return self._class_call_target(ast.unparse(function))

    def violates(self, candidate: ast.AST) -> bool:
        """Responsibilities: _temporary result rule decision_."""
        match candidate:
            case ast.Call(
                func=ast.Attribute(value=receiver) | ast.Subscript(value=receiver),
            ):
                if self.constructor_result(receiver):
                    return True
                return self._spread_literal_result(receiver)
            case ast.Call():
                return False
            case ast.Subscript():
                if self._call_index(candidate):
                    return True
        if self._literal_access(candidate):
            return True
        return self._constructor_access(candidate)
