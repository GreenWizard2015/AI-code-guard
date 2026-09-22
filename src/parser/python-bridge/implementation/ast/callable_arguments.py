from __future__ import annotations


from typing import Any
import ast

from implementation.ast.constants import BUILTIN_TYPES, STRUCTURAL_TYPE_NAMES
from implementation.ast.protocols import PythonAstNodeIndexProtocol
from implementation.types import JsonObject


class CallableArguments:
    """Responsibilities: _extraction Python callable argument_."""

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

    def _typed_argument(self, argument: ast.arg) -> list[dict[str, str]]:
        """Responsibilities: _normalization typed callable argument_."""
        annotation: Any = argument.annotation
        if annotation is None or type(annotation) not in (
            ast.Name,
            ast.Attribute,
            ast.Subscript,
        ):
            return []
        kind: Any = "named"
        if type(annotation) is ast.Name and annotation.id in self.builtin_types:
            kind: Any = "basic"
        if type(annotation) is ast.Subscript:
            kind: Any = "generic"
        return [{"name": argument.arg, "type": ast.unparse(annotation), "kind": kind}]

    def _typed_arguments(self, arguments: list[ast.arg]) -> list[dict[str, str]]:
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

    def __init__(self, node_index: PythonAstNodeIndexProtocol) -> None:
        """Responsibilities: _initialization reusable Python AST_."""
        self.node_index: Any = node_index
        self.builtin_types: Any = BUILTIN_TYPES
        self.structural_type_names: Any = STRUCTURAL_TYPE_NAMES

    def argument_metadata(
        self,
        node: ast.AST,
        arguments: list[ast.arg],
        characters: int,
    ) -> JsonObject:
        """Responsibilities: _construction normalization argument metadata_."""
        parameter_types: Any = [
            ast.unparse(argument.annotation)
            for argument in arguments
            if argument.annotation
        ]
        untyped_parameters: Any = [
            argument.arg
            for argument in arguments
            if argument.annotation is None and argument.arg not in ("self", "cls")
        ]
        has_self: Any = bool(arguments and arguments[0].arg == "self")
        return {
            "argument_count": len(arguments),
            "characters": characters,
            "parameter_types": parameter_types,
            "untyped_parameters": untyped_parameters,
            "argument_uses": self._argument_uses(node, arguments),
            "typed_arguments": self._typed_arguments(arguments),
            "decorators": self._decorator_names(node),
            "has_self": has_self,
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
        if name.startswith("__") and name.endswith("__"):
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
