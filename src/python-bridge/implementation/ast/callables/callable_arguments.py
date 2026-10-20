from __future__ import annotations

import ast
from typing import Any

from implementation.ast.constants import BUILTIN_TYPES, STRUCTURAL_TYPE_NAMES
from implementation.ast.protocols import PythonAstNodeIndexContract
from implementation.references.protocols import PythonScopedTypeAliasesContract
from implementation.types import JsonObject


class CallableArguments:
    """Responsibilities: _typed parameter extraction_, _callable metadata collection_."""

    def _argument_uses(
        self, node: ast.AST, arguments: list[ast.arg]
    ) -> list[JsonObject]:
        """Responsibilities: _callable reference count_."""
        counts: Any = {argument.arg: 0 for argument in arguments}
        argument_names: Any = set(counts)
        for item in self.node_index.nodes(node):
            if type(item) is ast.Name and type(item.ctx) is ast.Load:
                if item.id in argument_names:
                    counts[item.id] += 1
        return [{"name": name, "count": count} for name, count in counts.items()]

    def _annotation_type_name(self, argument: ast.arg, annotation: ast.AST) -> str:
        """Responsibilities: _parameter annotation names_."""
        type_name = ast.unparse(annotation)
        if type(annotation) is not ast.Name:
            return type_name
        resolved_type = self.type_aliases.resolve(annotation.id, argument)
        if resolved_type in self.builtin_types:
            return resolved_type
        return type_name

    def _annotation_kind(self, annotation: ast.AST, type_name: str) -> str:
        """Responsibilities: _parameter type classification_."""
        if type(annotation) is ast.Subscript:
            return "generic"
        if type_name in self.builtin_types:
            return "basic"
        return "named"

    def _typed_argument(self, argument: ast.arg) -> list[JsonObject]:
        """Responsibilities: _normalization typed callable argument_."""
        annotation: Any = argument.annotation
        if annotation is None:
            return []
        if type(annotation) not in (ast.Name, ast.Attribute, ast.Subscript):
            return []
        type_name = self._annotation_type_name(argument, annotation)
        kind = self._annotation_kind(annotation, type_name)
        return [{"name": argument.arg, "type": type_name, "kind": kind}]

    def _typed_arguments(self, arguments: list[ast.arg]) -> list[JsonObject]:
        """Responsibilities: _normalization typed callable arguments_."""
        if not arguments:
            return []
        typed: Any = [self._typed_argument(argument) for argument in arguments]
        return [item for items in typed for item in items]

    def _decorator_names(self, node: ast.AST) -> list[str]:
        """Responsibilities: _collection decorator names callable_."""
        names: Any = []
        for decorator in node.decorator_list:
            if type(decorator) is ast.Call:
                decorator: Any = decorator.func
            if type(decorator) is ast.Name:
                names.append(decorator.id)
            else:
                if type(decorator) is ast.Attribute:
                    names.append(decorator.attr)
        return names

    def _untyped_parameters(self, arguments: list[ast.arg]) -> list[str]:
        """Responsibilities: _collection untyped callable parameters_."""
        names: list[str] = []
        for argument in arguments:
            if argument.annotation is not None:
                continue
            if argument.arg in ("self", "cls"):
                continue
            names.append(argument.arg)
        return names

    def _has_self(self, arguments: list[ast.arg]) -> bool:
        """Responsibilities: _classification callable self parameter_."""
        if not arguments:
            return False
        return arguments[0].arg == "self"

    def __init__(
        self,
        node_index: PythonAstNodeIndexContract,
        type_aliases: PythonScopedTypeAliasesContract,
    ) -> None:
        """Responsibilities: _initialization reusable Python AST_."""
        self.node_index: Any = node_index
        self.type_aliases: PythonScopedTypeAliasesContract = type_aliases
        self.builtin_types: Any = BUILTIN_TYPES
        self.structural_type_names: Any = STRUCTURAL_TYPE_NAMES

    def argument_metadata(
        self,
        node: ast.AST,
        arguments: list[ast.arg],
        characters: int,
    ) -> JsonObject:
        """Responsibilities: _construction normalization argument metadata_."""
        return {
            "argument_count": len(arguments),
            "characters": characters,
            "parameter_types": [
                ast.unparse(argument.annotation)
                for argument in arguments
                if argument.annotation
            ],
            "untyped_parameters": self._untyped_parameters(arguments),
            "argument_uses": self._argument_uses(node, arguments),
            "typed_arguments": self._typed_arguments(arguments),
            "decorators": self._decorator_names(node),
            "has_self": self._has_self(arguments),
            "visibility": self.method_visibility(node.name),
        }

    def structural_type(self, node: ast.AST) -> bool:
        """Responsibilities: _classification AST expression structural_."""
        if type(node) is ast.BinOp:
            return type(node.op) is ast.BitOr
        if type(node) is ast.Name:
            return node.id[:1].isupper()
        if type(node) is not ast.Subscript or type(node.value) is not ast.Name:
            return False
        return node.value.id in self.structural_type_names

    def method_visibility(self, name: str) -> str:
        """Responsibilities: _classification Python method visibility_."""
        if name.startswith("__"):
            if name.endswith("__"):
                return "public"
        if name.startswith("_"):
            return "private"
        return "public"

    def callable_arguments(
        self,
        node: ast.AST,
    ) -> list[ast.arg]:
        """Responsibilities: _output positional variadic keyword-only_."""
        arguments: Any = [*node.args.posonlyargs, *node.args.args]
        arguments.extend(node.args.kwonlyargs)
        if node.args.vararg:
            arguments.append(node.args.vararg)
        if node.args.kwarg:
            arguments.append(node.args.kwarg)
        return arguments
