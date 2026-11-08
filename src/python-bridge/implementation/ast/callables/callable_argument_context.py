from __future__ import annotations

import ast
from typing import cast

from implementation.ast.constants import BUILTIN_TYPES
from implementation.ast.protocols import PythonAstNodeIndexContract
from implementation.references.protocols import PythonScopedTypeAliasesContract
from implementation.types import JsonObject, JsonValueList


class CallableArgumentContext:
    """Responsibilities: _callable signature state_, _callable parameter metadata_."""

    def _typed_argument(self, argument: ast.arg) -> list[JsonObject]:
        """Responsibilities: _typed callable parameter normalization_."""
        annotation = argument.annotation
        if annotation is None:
            return []
        if type(annotation) not in (
            ast.Name,
            ast.Attribute,
            ast.Subscript,
        ):
            return []
        type_name = self._annotation_type(argument, annotation)
        kind = "generic"
        if type(annotation) is not ast.Subscript:
            kind = "basic" if type_name in BUILTIN_TYPES else "named"
        return [{"name": argument.arg, "type": type_name, "kind": kind}]

    def _decorators(self) -> list[str]:
        """Responsibilities: _callable decorator names_."""
        names: list[str] = []
        for decorator in self._decorator_nodes:
            if type(decorator) is ast.Call:
                decorator_expression = decorator.func
            else:
                decorator_expression = decorator
            if type(decorator_expression) is ast.Name:
                names.append(decorator_expression.id)
            else:
                if type(decorator_expression) is ast.Attribute:
                    names.append(decorator_expression.attr)
        return names

    def _parameterized_case_count(self) -> int:
        """Responsibilities: _parameterized case metadata_."""
        for decorator in self._decorator_nodes:
            if type(decorator) is not ast.Call:
                continue
            target = decorator.func
            is_expand = type(target) is ast.Attribute and target.attr == "expand"
            is_expand = is_expand or (type(target) is ast.Name and target.id == "expand")
            if not is_expand or not decorator.args:
                continue
            cases = decorator.args[0]
            match cases:
                case ast.List(elts=elements):
                    return len(elements)
                case ast.Tuple(elts=elements):
                    return len(elements)
        return 0

    def _untyped_parameters(self) -> list[str]:
        """Responsibilities: _untyped callable parameter collection_."""
        return [
            argument.arg
            for argument in self._arguments
            if argument.annotation is None and argument.arg not in ("self", "cls")
        ]

    def _uses(self) -> list[JsonObject]:
        """Responsibilities: _callable parameter reference counts_."""
        arguments = self._arguments
        counts: dict[str, int] = {argument.arg: 0 for argument in arguments}
        argument_names = set(counts)
        for item in self._node_index.nodes(self._node):
            if type(item) is ast.Name and type(item.ctx) is ast.Load and item.id in argument_names:
                counts[item.id] += 1
        return [{"name": name, "count": count} for name, count in counts.items()]

    def _annotation_type(self, argument: ast.arg, annotation: ast.AST) -> str:
        """Responsibilities: _parameter annotation names_."""
        type_name = ast.unparse(annotation)
        if type(annotation) is not ast.Name:
            return type_name
        resolved_type = self._type_aliases.resolve(annotation.id, argument)
        if resolved_type in BUILTIN_TYPES:
            return resolved_type
        return type_name

    def __init__(
        self,
        node: ast.AST,
        node_index: PythonAstNodeIndexContract,
        type_aliases: PythonScopedTypeAliasesContract,
        arguments: list[ast.arg],
    ) -> None:
        """Responsibilities: _callable signature ownership_."""
        if type(node) is ast.FunctionDef or type(node) is ast.AsyncFunctionDef:
            callable_name = node.name
            decorator_nodes = node.decorator_list
        else:
            raise TypeError(
                f"CallableArgumentContext received unsupported node: {type(node).__name__}.",
            )
        self._callable_name: str = callable_name
        self._decorator_nodes: list[ast.expr] = decorator_nodes
        self._node: ast.AST = node
        self._node_index: PythonAstNodeIndexContract = node_index
        self._type_aliases: PythonScopedTypeAliasesContract = type_aliases
        self._arguments: list[ast.arg] = arguments

    def visibility(self) -> str:
        """Responsibilities: _Python method visibility classification_."""
        name = self._callable_name
        if name.startswith("__"):
            if name.endswith("__"):
                return "public"
        if name.startswith("_"):
            return "private"
        return "public"

    def metadata(self, characters: int) -> JsonObject:
        """Responsibilities: _callable signature metadata_."""
        arguments = self._arguments
        typed = [self._typed_argument(argument) for argument in arguments]
        return {
            "argument_count": len(arguments),
            "characters": characters,
            "parameter_types": cast(
                JsonValueList,
                [ast.unparse(argument.annotation) for argument in arguments if argument.annotation],
            ),
            "untyped_parameters": cast(JsonValueList, self._untyped_parameters()),
            "argument_uses": cast(JsonValueList, self._uses()),
            "typed_arguments": cast(
                JsonValueList,
                [item for items in typed for item in items],
            ),
            "decorators": cast(JsonValueList, self._decorators()),
            "parameterized_case_count": self._parameterized_case_count(),
            "has_self": bool(arguments) and arguments[0].arg == "self",
            "visibility": self.visibility(),
        }
