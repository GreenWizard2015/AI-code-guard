from __future__ import annotations

import ast

from implementation.ast.callables.module_instances.python_module_instance_alias_state import (
    PythonModuleInstanceAliasState,
)
from implementation.ast.callables.module_instances.python_module_instance_statement import (
    PythonModuleInstanceStatement,
)
from implementation.ast.protocols import (
    PythonModuleInstanceAliasStateContract,
    PythonModuleInstanceStatementContract,
)
from implementation.references.aliases.python_reference_aliases import (
    PythonReferenceAliases,
    PythonReferenceAliasState,
)
from implementation.references.protocols import PythonReferenceAliasesContract
from implementation.types import JsonObject, PythonAstNodeList, PythonAstNodeTypeSet


class PythonModuleInstanceCollector:
    """Responsibilities: _module instance collection_, _class alias resolution_."""

    def _statement_nodes(
        self,
        node: ast.AST,
        excluded: PythonAstNodeTypeSet,
    ) -> PythonAstNodeList:
        """Responsibilities: _module statement subtree collection_."""
        if type(node) in excluded:
            return []
        statements: PythonAstNodeList = []
        if ast.stmt in type(node).__mro__:
            statements.append(node)
        if type(node) is ast.If:
            statement = PythonModuleInstanceStatement(node)
            main_guard = statement.main_guard()
            if main_guard:
                return statements
        children = list(ast.iter_child_nodes(node))
        statements.extend(self._nested_statement_nodes(children, excluded))
        return statements

    def _module_statement_nodes(self, nodes: PythonAstNodeList) -> PythonAstNodeList:
        """Responsibilities: _module statement traversal_."""
        excluded: PythonAstNodeTypeSet = {
            ast.FunctionDef,
            ast.AsyncFunctionDef,
            ast.ClassDef,
            ast.Lambda,
        }
        statements: PythonAstNodeList = []
        for node in nodes:
            statements.extend(self._statement_nodes(node, excluded))
        return statements

    def _nested_statement_nodes(
        self,
        children: PythonAstNodeList,
        excluded: PythonAstNodeTypeSet,
    ) -> PythonAstNodeList:
        """Responsibilities: _nested module statement traversal_."""
        nested_nodes: PythonAstNodeList = []
        for child in children:
            if ast.expr in type(child).__mro__ or type(child) in excluded:
                continue
            nested_nodes.append(child)
        return self._module_statement_nodes(nested_nodes)

    def __init__(self, tree: ast.Module) -> None:
        """Responsibilities: _module instance source initialization_."""
        self._tree: ast.Module = tree
        self._reference_aliases: PythonReferenceAliasesContract = PythonReferenceAliases(
            PythonReferenceAliasState(),
        )

    def statement_instances(
        self,
        statement: PythonModuleInstanceStatementContract,
        aliases: PythonModuleInstanceAliasStateContract,
    ) -> list[JsonObject]:
        """Responsibilities: _statement instance extraction_."""
        node = statement.node()
        if type(node) is ast.AnnAssign and node.value is None:
            return []
        value = statement.assignment_value()
        aliases.record(statement)
        return aliases.instance_records(value)

    def collect(self) -> list[JsonObject]:
        """Responsibilities: _module instances extraction_."""
        instances: list[JsonObject] = []
        aliases = PythonModuleInstanceAliasState(self._reference_aliases)
        for node in self._module_statement_nodes(list(self._tree.body)):
            statement = PythonModuleInstanceStatement(node)
            instances.extend(self.statement_instances(statement, aliases))
        return instances
