from __future__ import annotations

import ast

from implementation.types import PythonAstParentIndex


class PythonFiniteVariantFunctionTypes:
    """Responsibilities: _match subject types_, _return types_."""

    _tree: ast.AST
    _parents: PythonAstParentIndex

    def _name(self, node: ast.AST) -> str:
        """Responsibilities: _annotation type name extraction_."""
        if type(node) is ast.Name:
            return node.id
        if type(node) is ast.Attribute:
            return node.attr
        return ""

    def _function_owner(self, node: ast.AST) -> ast.AST:
        """Responsibilities: _enclosing callable lookup_."""
        current = self._parents.get(node)
        while current is not None:
            if type(current) in (ast.FunctionDef, ast.AsyncFunctionDef):
                return current
            current = self._parents.get(current)
        return self._tree

    def _argument_type(self, function: ast.AST, name: str) -> str:
        """Responsibilities: _annotated parameter type lookup_."""
        match function:
            case ast.FunctionDef(args=arguments) | ast.AsyncFunctionDef(args=arguments):
                for argument in [*arguments.posonlyargs, *arguments.args, *arguments.kwonlyargs]:
                    if argument.arg == name and argument.annotation is not None:
                        return self._name(argument.annotation)
        return ""

    def __init__(self, tree: ast.AST, parents: PythonAstParentIndex) -> None:
        """Responsibilities: _finite mapping syntax ownership_."""
        self._tree = tree
        self._parents = parents

    def source_type(self, source_match: ast.Match) -> str:
        """Responsibilities: _match subject type resolution_."""
        if type(source_match.subject) is not ast.Name:
            return ""
        function = self._function_owner(source_match)
        if function is self._tree:
            return ""
        return self._argument_type(function, source_match.subject.id)

    def target_type(self, result_match: ast.Match) -> str:
        """Responsibilities: _match result type resolution_."""
        function = self._function_owner(result_match)
        match function:
            case ast.FunctionDef(returns=returns) | ast.AsyncFunctionDef(returns=returns):
                if returns is not None:
                    return self._name(returns)
        return ""
