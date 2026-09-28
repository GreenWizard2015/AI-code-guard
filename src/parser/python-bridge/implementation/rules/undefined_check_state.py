from __future__ import annotations


import ast
from typing import Any, cast

from implementation.references.aliases.reference_aliases import PythonReferenceAliases


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
        if type(node.target) is not ast.Name:
            return {}
        if node.annotation is None:
            return {}
        return {node.target.id: node.annotation}

    def _alias_assignment(self, node: ast.AST) -> dict[str, str]:
        """Responsibilities: _collection instance alias assignment_."""
        if type(node) is not ast.Assign:
            return {}
        if len(node.targets) != 1:
            return {}
        values = self.assignment_aliases.target_values(node.targets[0], node.value)
        aliases: dict[str, str] = {}
        for target, value in values.items():
            if type(value) is ast.Name:
                aliases[target] = value.id
        return aliases

    def _resolve_alias(
        self,
        name: str,
        aliases: dict[str, str],
        bindings: dict,
        visiting: set[str],
    ) -> ast.expr:
        """Responsibilities: _resolution instance alias chain_."""
        if name in bindings:
            return bindings[name]
        if name in visiting:
            return ast.Constant(value=None)
        source = aliases.get(name)
        if source is None:
            return ast.Constant(value=None)
        visiting.add(name)
        annotation = self._resolve_alias(source, aliases, bindings, visiting)
        visiting.remove(name)
        return annotation

    def _annotated_bindings(self, nodes: list[ast.AST]) -> dict:
        """Responsibilities: _collection annotated instance bindings_."""
        bindings: dict = {}
        for node in nodes:
            if type(node) in (ast.FunctionDef, ast.AsyncFunctionDef):
                bindings.update(self._function_bindings(node))
            if type(node) is ast.AnnAssign:
                bindings.update(self._assignment_binding(node))
        return bindings

    def _alias_bindings(self, nodes: list[ast.AST], bindings: dict) -> dict:
        """Responsibilities: _resolution instance alias bindings_."""
        aliases: dict[str, str] = {}
        for node in nodes:
            aliases.update(self._alias_assignment(node))
        return {
            name: self._resolve_alias(name, aliases, bindings, set())
            for name in aliases
        }

    def _classes(self, tree: ast.Module) -> dict[str, ast.ClassDef]:
        """Responsibilities: _class declarations collection_."""
        classes: dict[str, ast.ClassDef] = {}
        for node in ast.walk(tree):
            if type(node) is ast.ClassDef:
                classes[node.name] = node
        return classes

    def _own_fields(self, classes: dict[str, ast.ClassDef]) -> dict[str, dict]:
        """Responsibilities: _class field annotations collection_."""
        own_fields: dict[str, dict] = {}
        for name, node in classes.items():
            fields: dict = {}
            for item in node.body:
                if type(item) is not ast.AnnAssign:
                    continue
                if type(item.target) is not ast.Name:
                    continue
                if item.annotation is not None:
                    fields[item.target.id] = item.annotation
            own_fields[name] = fields
        return own_fields

    def _inherited_fields(
        self,
        name: str,
        seen: set[str],
        classes: dict[str, ast.ClassDef],
        own_fields: dict[str, dict],
    ) -> dict:
        """Responsibilities: _inherited class fields resolution_."""
        if name in seen:
            return {}
        current = classes.get(name)
        if current is None:
            return {}
        next_seen = set(seen)
        next_seen.add(name)
        result: dict = {}
        for base in current.bases:
            if type(base) is ast.Name:
                result.update(
                    self._inherited_fields(base.id, next_seen, classes, own_fields)
                )
        result.update(own_fields.get(name, {}))
        return result

    def __init__(self, bindings: dict, fields: dict) -> None:
        """Responsibilities: _initialization binding field state_."""
        self.bindings: Any = bindings
        self.fields: Any = fields
        self.assignment_aliases: PythonReferenceAliases = PythonReferenceAliases()

    def fields_for(self, tree: ast.Module) -> dict:
        """Responsibilities: _annotated class fields collection_."""
        classes = self._classes(tree)
        own_fields = self._own_fields(classes)
        return {
            name: self._inherited_fields(name, set(), classes, own_fields)
            for name in classes
        }

    def bindings_for(self, tree: ast.Module) -> dict:
        """Responsibilities: _collection annotated function assignment_."""
        nodes = list(ast.walk(tree))
        bindings = self._annotated_bindings(nodes)
        bindings.update(self._alias_bindings(nodes, bindings))
        return bindings
