from __future__ import annotations

from implementation.ast.callable_nodes.python_function_nodes import (
    PythonFunctionNodes,
)
from implementation.ast.callable_nodes.python_function_selector import (
    PythonFunctionSelector,
)
from implementation.ast.callable_nodes.types import PythonFunctionNodesOptions
from implementation.ast.callables.callable_arguments import CallableArguments
from implementation.ast.callables.module_instances.python_module_instance_collector import (
    PythonModuleInstanceCollector,
)
from implementation.ast.callables.symbol_collection.python_ast_symbol_nodes import (
    PythonAstSymbolNodes,
)
from implementation.ast.callables.symbol_collection.python_ast_symbol_nodes_options import (
    PythonAstSymbolNodesOptions,
)
from implementation.ast.protocols import (
    PythonAstCallableDependenciesOptionsContract,
    PythonAstSymbolNodesContract,
    PythonFunctionNodesContract,
)
from implementation.ast.type_declarations.python_type_declaration_collector import (
    PythonTypeDeclarationCollector,
)
from implementation.references.test_assertions.python_test_assertion_data import (
    PythonTestAssertionData,
)


class PythonAstCallableDependencies:
    """Responsibilities: _callable dependency assembly_, _symbol node access_."""

    def __init__(self, options: PythonAstCallableDependenciesOptionsContract) -> None:
        """Responsibilities: _callable dependency input initialization_."""
        self._options: PythonAstCallableDependenciesOptionsContract = options

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
            ),
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
                PythonTypeDeclarationCollector(
                    options.tree,
                    callable_arguments,
                    options.node_index,
                ),
                PythonModuleInstanceCollector(options.tree),
            ),
        )
