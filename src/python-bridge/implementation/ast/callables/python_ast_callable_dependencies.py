from __future__ import annotations

import ast
from dataclasses import dataclass

from implementation.ast.callable_nodes.function_nodes import (
    PythonFunctionNodes,
    PythonFunctionNodesOptions,
)
from implementation.ast.callable_nodes.python_function_selector import (
    PythonFunctionSelector,
)
from implementation.ast.callables.callable_arguments import CallableArguments
from implementation.ast.callables.symbol_nodes import (
    PythonAstSymbolNodes,
    PythonAstSymbolNodesOptions,
)
from implementation.ast.type_declarations.python_type_declaration_collector import (
    PythonTypeDeclarationCollector,
)
from implementation.ast.protocols import (
    PythonAstNodeIndexContract,
    PythonAstSymbolNodesContract,
    PythonFunctionNodesContract,
    PythonSourceSegmentsContract,
)
from implementation.references.protocols import PythonContainerAliasesContract
from implementation.references.protocols import PythonScopedTypeAliasesContract
from implementation.ast.callables.python_module_instance_collector import (
    PythonModuleInstanceCollector,
)
from implementation.references.test_assertions.python_test_assertion_data import (
    PythonTestAssertionData,
)


@dataclass(frozen=True)
class PythonAstCallableDependenciesOptions:
    """Responsibilities: _callable dependency inputs_."""

    tree: ast.Module
    node_index: PythonAstNodeIndexContract
    source_segments: PythonSourceSegmentsContract
    container_aliases: PythonContainerAliasesContract
    type_aliases: PythonScopedTypeAliasesContract


class PythonAstCallableDependencies:
    """Responsibilities: _callable dependency assembly_, _symbol node access_."""

    def __init__(self, options: PythonAstCallableDependenciesOptions) -> None:
        """Responsibilities: _callable dependency input initialization_."""
        self._options: PythonAstCallableDependenciesOptions = options

    def function_nodes(self) -> PythonFunctionNodesContract:
        """Responsibilities: _function node dependency access_."""
        options = self._options
        return PythonFunctionNodes(
            PythonFunctionNodesOptions(
                options.tree,
                options.node_index,
                options.source_segments,
                options.container_aliases,
                PythonFunctionSelector(options.tree, options.node_index),
                PythonTestAssertionData(options.node_index, options.container_aliases),
                options.type_aliases,
            )
        )

    def symbols(self) -> PythonAstSymbolNodesContract:
        """Responsibilities: _symbol dependency access_."""
        options = self._options
        callable_arguments = CallableArguments(options.node_index, options.type_aliases)
        return PythonAstSymbolNodes(
            PythonAstSymbolNodesOptions(
                options.tree,
                options.node_index,
                callable_arguments,
                PythonTypeDeclarationCollector(options.tree, callable_arguments),
                PythonModuleInstanceCollector(options.tree),
            )
        )
