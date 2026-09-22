from __future__ import annotations


import ast
from typing import Any, cast


class UndefinedCheckState:
    """Responsibilities: _annotated function bindings collection_, _annotated fields collection_."""

    def _function_bindings(self, node: ast.AST) -> dict:
        """Responsibilities: _annotated function arguments collection_."""
        function: Any = cast(ast.FunctionDef, node)
        arguments: Any = (
            function.args.posonlyargs + function.args.args + function.args.kwonlyargs
        )
        if function.args.vararg is not None:
            arguments.append(function.args.vararg)
        if function.args.kwarg is not None:
            arguments.append(function.args.kwarg)
        return {
            argument.arg: argument.annotation
            for argument in arguments
            if argument.annotation is not None
        }

    def _assignment_binding(self, node: ast.AnnAssign) -> dict:
        """Responsibilities: _collection annotated assignment binding_."""
        if type(node.target) is not ast.Name or node.annotation is None:
            return {}
        return {node.target.id: node.annotation}

    def __init__(self, bindings: dict, fields: dict) -> None:
        """Responsibilities: _initialization binding field state_."""
        self.bindings: Any = bindings
        self.fields: Any = fields

    def fields_for(self, tree: ast.Module) -> dict:
        """Responsibilities: _annotated class fields collection_."""
        fields: dict = {}
        for node in ast.walk(tree):
            if type(node) is not ast.ClassDef:
                continue
            fields[node.name] = {
                item.target.id: item.annotation
                for item in node.body
                if type(item) is ast.AnnAssign
                and type(item.target) is ast.Name
                and item.annotation is not None
            }
        return fields

    def bindings_for(self, tree: ast.Module) -> dict:
        """Responsibilities: _collection annotated function assignment_."""
        bindings: dict = {}
        for node in ast.walk(tree):
            if type(node) in (ast.FunctionDef, ast.AsyncFunctionDef):
                bindings.update(self._function_bindings(node))
            if type(node) is ast.AnnAssign:
                bindings.update(self._assignment_binding(node))
        return bindings
