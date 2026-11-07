from __future__ import annotations

import ast

from implementation.ast.callables.symbol_collection.python_function_symbol import (
    PythonFunctionSymbol,
)
from implementation.ast.callables.symbol_collection.python_stored_symbol import (
    PythonStoredSymbol,
)
from implementation.ast.protocols import (
    PythonAstNodeIndexContract,
    PythonAstSymbolNodesOptionsContract,
    PythonCallableArgumentsContract,
    PythonStoredSymbolContextContract,
    PythonTypeDeclarationCollectorContract,
)
from implementation.rules.constants import PYTHON_VARIABLE_KIND
from implementation.types import JsonObject
from protocols import PythonModuleInstanceCollectorContract


class PythonAstSymbolNodes(PythonStoredSymbolContextContract):
    """Responsibilities: _symbol classification_, _symbol declaration normalization_."""

    def _named_symbol(self, node: ast.AST) -> list[JsonObject]:
        """Responsibilities: _named symbol collection_."""
        if type(node) is ast.FunctionDef or type(node) is ast.AsyncFunctionDef:
            function_symbol = PythonFunctionSymbol(
                node,
                self._tree,
                self._node_index,
                self._callable_arguments,
            )
            return [function_symbol.record()]
        if type(node) is ast.arg:
            return [
                {
                    "name": node.arg,
                    "line": node.lineno - 1,
                    "kind": PYTHON_VARIABLE_KIND,
                },
            ]
        if type(node) is ast.Name and type(node.ctx) is ast.Store:
            stored_symbol = PythonStoredSymbol(node, self)
            return stored_symbol.records()
        return []

    def __init__(self, options: PythonAstSymbolNodesOptionsContract) -> None:
        """Responsibilities: _Python symbol analysis initialization_."""
        self._tree: ast.Module = options.tree
        self._node_index: PythonAstNodeIndexContract = options.node_index
        self._callable_arguments: PythonCallableArgumentsContract = options.callable_arguments
        self._type_collector: PythonTypeDeclarationCollectorContract = options.type_collector
        self._instance_collector: PythonModuleInstanceCollectorContract = options.instance_collector

    def named_symbols(self) -> list[JsonObject]:
        """Responsibilities: _named symbols exposure collection_."""
        symbols: list[JsonObject] = []
        for node in self._node_index.nodes(self._tree):
            symbols.extend(self._named_symbol(node))
        return symbols

    def type_declarations(self) -> list[JsonObject]:
        """Responsibilities: _type declarations exposure collection_."""
        nodes = self._node_index.nodes(self._tree)
        return self._type_collector.declarations(nodes)

    def module_instances(self) -> list[JsonObject]:
        """Responsibilities: _module instances exposure collection_."""
        instances = self._instance_collector.collect()
        return [instance for instance in instances if "line" in instance]

    def tree(self) -> ast.Module:
        """Responsibilities: _symbol source tree access_."""
        return self._tree

    def node_index(self) -> PythonAstNodeIndexContract:
        """Responsibilities: _symbol node index access_."""
        return self._node_index

    def callable_arguments(self) -> PythonCallableArgumentsContract:
        """Responsibilities: _symbol callable analysis access_."""
        return self._callable_arguments

    def type_collector(self) -> PythonTypeDeclarationCollectorContract:
        """Responsibilities: _symbol type analysis access_."""
        return self._type_collector
