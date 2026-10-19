from __future__ import annotations

import ast

from implementation.ast.callable_nodes.function_nodes import (
    PythonFunctionNodes,
    PythonFunctionNodesOptions,
)
from implementation.ast.callable_nodes.python_function_selector import (
    PythonFunctionSelector,
)
from implementation.ast.callables.callable_arguments import CallableArguments
from implementation.ast.symbol_nodes import (
    PythonAstSymbolNodes,
    PythonAstSymbolNodesOptions,
)
from implementation.ast.type_declarations.python_type_declaration_collector import (
    PythonTypeDeclarationCollector,
)
from implementation.protocols import (
    PythonAstNodeIndexContract,
    PythonAstSymbolNodesContract,
    PythonFunctionNodesContract,
    PythonSourceSegmentsContract,
)
from implementation.references.aliases.protocols import PythonContainerAliasesContract
from implementation.ast.callables.python_module_instance_collector import (
    PythonModuleInstanceCollector,
)
from implementation.references.test_assertions.python_test_assertion_data import (
    PythonTestAssertionData,
)


class PythonAstCallableDependencies:
    """Responsibilities: _callable dependency assembly_, _symbol node access_."""

    def __init__(
        self,
        tree: ast.Module,
        node_index: PythonAstNodeIndexContract,
        source_segments: PythonSourceSegmentsContract,
        container_aliases: PythonContainerAliasesContract,
    ) -> None:
        """Responsibilities: _callable dependency input initialization_."""
        self._tree: ast.Module = tree
        self._node_index: PythonAstNodeIndexContract = node_index
        self._source_segments: PythonSourceSegmentsContract = source_segments
        self._container_aliases: PythonContainerAliasesContract = container_aliases

    def function_nodes(self) -> PythonFunctionNodesContract:
        """Responsibilities: _function node dependency access_."""
        return PythonFunctionNodes(
            PythonFunctionNodesOptions(
                self._tree,
                self._node_index,
                self._source_segments,
                self._container_aliases,
                PythonFunctionSelector(self._tree, self._node_index),
                PythonTestAssertionData(self._node_index, self._container_aliases),
            )
        )

    def symbols(self) -> PythonAstSymbolNodesContract:
        """Responsibilities: _symbol dependency access_."""
        callable_arguments = CallableArguments(self._node_index)
        return PythonAstSymbolNodes(
            PythonAstSymbolNodesOptions(
                self._tree,
                self._node_index,
                callable_arguments,
                PythonTypeDeclarationCollector(self._tree, callable_arguments),
                PythonModuleInstanceCollector(self._tree),
            )
        )
