from __future__ import annotations

import ast

from implementation.ast.protocols import PythonAstNodeIndexContract
from implementation.references.protocols import PythonReferenceAliasesContract
from implementation.rules.coding_issues.states.python_alias_graph import (
    PythonAliasGraph,
)
from implementation.rules.coding_issues.states.python_inherited_fields import (
    PythonInheritedFields,
)
from implementation.types import PythonAnnotatedFieldMap, PythonClassFieldMap


class UndefinedCheckState:
    """Responsibilities: _annotated function bindings collection_, _annotated fields collection_."""

    def _function_bindings(self, function: ast.AST) -> dict[str, ast.expr]:
        """Responsibilities: _annotated function arguments collection_."""
        match function:
            case ast.FunctionDef(args=signature) | ast.AsyncFunctionDef(args=signature):
                pass
            case _:
                return {}
        arguments = signature.posonlyargs + signature.args + signature.kwonlyargs
        if signature.vararg is not None:
            arguments.append(signature.vararg)
        if signature.kwarg is not None:
            arguments.append(signature.kwarg)
        return {argument.arg: argument.annotation for argument in arguments if argument.annotation is not None}

    def _assignment_binding(self, node: ast.AnnAssign) -> dict[str, ast.expr]:
        """Responsibilities: _collection annotated assignment binding_."""
        if type(node.target) is not ast.Name:
            return {}
        return {node.target.id: node.annotation}

    def _alias_assignment(self, node: ast.AST) -> dict[str, str]:
        """Responsibilities: _collection instance alias assignment_."""
        if type(node) is not ast.Assign:
            return {}
        if len(node.targets) != 1:
            return {}
        values = self._assignment_aliases.target_values(node.targets[0], node.value)
        aliases: dict[str, str] = {}
        for target, value in values.items():
            if type(value) is ast.Name:
                aliases[target] = value.id
        return aliases

    def _annotated_bindings(self, nodes: list[ast.AST]) -> dict[str, ast.expr]:
        """Responsibilities: _collection annotated instance bindings_."""
        bindings: dict[str, ast.expr] = {}
        for node in nodes:
            match node:
                case ast.FunctionDef() | ast.AsyncFunctionDef():
                    bindings.update(self._function_bindings(node))
                case ast.AnnAssign():
                    bindings.update(self._assignment_binding(node))
        return bindings

    def _alias_bindings(
        self,
        nodes: list[ast.AST],
        bindings: dict[str, ast.expr],
    ) -> dict[str, ast.expr]:
        """Responsibilities: _resolution instance alias bindings_."""
        aliases: dict[str, str] = {}
        for node in nodes:
            aliases.update(self._alias_assignment(node))
        alias_graph = PythonAliasGraph(aliases, bindings)
        return alias_graph.resolve_all()

    def _classes(self, class_declaration_module: ast.Module) -> dict[str, ast.ClassDef]:
        """Responsibilities: _class declarations collection_."""
        classes: dict[str, ast.ClassDef] = {}
        for node in self._node_index.nodes(class_declaration_module):
            if type(node) is ast.ClassDef:
                classes[node.name] = node
        return classes

    def _own_fields(self, classes: dict[str, ast.ClassDef]) -> PythonClassFieldMap:
        """Responsibilities: _class field annotations collection_."""
        own_fields: PythonClassFieldMap = {}
        for name, node in classes.items():
            fields: PythonAnnotatedFieldMap = {}
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
        bindings: dict[str, ast.expr],
        fields: PythonClassFieldMap,
        assignment_aliases: PythonReferenceAliasesContract,
        node_index: PythonAstNodeIndexContract,
    ) -> None:
        """Responsibilities: _initialization binding field state_."""
        self._bindings: dict[str, ast.expr] = bindings
        self._fields: PythonClassFieldMap = fields
        self._assignment_aliases: PythonReferenceAliasesContract = assignment_aliases
        self._node_index: PythonAstNodeIndexContract = node_index

    def fields_for(self, field_analysis_module: ast.Module) -> PythonClassFieldMap:
        """Responsibilities: _annotated class fields collection_."""
        classes = self._classes(field_analysis_module)
        own_fields = self._own_fields(classes)
        inherited_fields = PythonInheritedFields(classes, own_fields)
        return inherited_fields.fields()

    def bindings(self) -> dict[str, ast.expr]:
        """Responsibilities: _undefined check bindings access_."""
        return self._bindings

    def fields(self) -> PythonClassFieldMap:
        """Responsibilities: _undefined check fields access_."""
        return self._fields

    def bindings_for(self, binding_analysis_module: ast.Module) -> dict[str, ast.expr]:
        """Responsibilities: _collection annotated function assignment_."""
        nodes = self._node_index.nodes(binding_analysis_module)
        bindings = self._annotated_bindings(nodes)
        bindings.update(self._alias_bindings(nodes, bindings))
        return bindings
