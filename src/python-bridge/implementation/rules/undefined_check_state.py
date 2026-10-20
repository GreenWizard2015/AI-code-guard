from __future__ import annotations

import ast
from typing import Any, cast

from implementation.references.protocols import PythonReferenceAliasesContract
from implementation.rules.python_inherited_fields import PythonInheritedFields
from implementation.rules.protocols import AliasWalkStateContract
from implementation.rules.alias_walk_state import AliasWalkState
from implementation.rules.types import AliasWalkStateDataContract


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

    def _alias_state(
        self,
        name: str,
        aliases: dict[str, str],
        bindings: dict,
        resolved: dict[str, ast.expr],
    ) -> AliasWalkStateContract:
        """Responsibilities: _alias traversal state construction_."""
        return AliasWalkState(
            AliasWalkStateDataContract(
                name,
                aliases,
                bindings,
                resolved,
                [],
                {},
                ast.Constant(value=None),
                False,
            )
        )

    def _cache_alias_result(
        self,
        name: str,
        result_state: AliasWalkStateContract,
        resolved: dict[str, ast.expr],
    ) -> ast.expr:
        """Responsibilities: _alias resolution cache_."""
        snapshot = result_state.snapshot()
        expression = snapshot.result
        for alias in reversed(snapshot.path):
            if alias not in resolved:
                resolved[alias] = expression
            expression = resolved[alias]
        return resolved.get(name, expression)

    def _resolve_alias(
        self,
        name: str,
        aliases: dict[str, str],
        bindings: dict,
        resolved: dict[str, ast.expr],
    ) -> ast.expr:
        """Responsibilities: _resolution instance alias chain_."""
        if name in bindings:
            return bindings[name]
        if name in resolved:
            return resolved[name]
        return self._cache_alias_result(
            name,
            self._walk_aliases(self._alias_state(name, aliases, bindings, resolved)),
            resolved,
        )

    def _walk_aliases(self, state: AliasWalkStateContract) -> AliasWalkStateContract:
        """Responsibilities: _iterative alias chain traversal_."""
        while True:
            state = state.known_result()
            snapshot = state.snapshot()
            if snapshot.result_present:
                return state
            current = snapshot.current
            cycle_start = snapshot.positions.get(current)
            if cycle_start is not None:
                return state.cycle_result(cycle_start)
            source = snapshot.aliases.get(current)
            if source is None:
                return state.with_result(ast.Constant(value=None))
            state = state.visit(source)

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
        resolved: dict[str, ast.expr] = {}
        return {
            name: self._resolve_alias(name, aliases, bindings, resolved)
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

    def __init__(
        self,
        bindings: dict,
        fields: dict,
        assignment_aliases: PythonReferenceAliasesContract,
    ) -> None:
        """Responsibilities: _initialization binding field state_."""
        self._bindings: Any = bindings
        self._fields: Any = fields
        self.assignment_aliases: PythonReferenceAliasesContract = assignment_aliases

    def fields_for(self, tree: ast.Module) -> dict:
        """Responsibilities: _annotated class fields collection_."""
        classes = self._classes(tree)
        own_fields = self._own_fields(classes)
        inherited_fields = PythonInheritedFields(classes, own_fields)
        return inherited_fields.fields()

    def bindings(self) -> dict:
        """Responsibilities: _undefined check bindings access_."""
        return self._bindings

    def fields(self) -> dict:
        """Responsibilities: _undefined check fields access_."""
        return self._fields

    def bindings_for(self, tree: ast.Module) -> dict:
        """Responsibilities: _collection annotated function assignment_."""
        nodes = list(ast.walk(tree))
        bindings = self._annotated_bindings(nodes)
        bindings.update(self._alias_bindings(nodes, bindings))
        return bindings
