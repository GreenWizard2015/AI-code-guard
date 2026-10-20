from __future__ import annotations

import ast

from implementation.ast.callables.callable_statements import CallableStatements
from implementation.ast.callables.scoped_type_aliases import PythonScopedTypeAliases
from implementation.ast.type_declarations.python_module_constant_spans import (
    PythonModuleConstantSpans,
)
from implementation.ast.protocols import (
    PythonAstNodeIndexContract,
    PythonModuleConstantSpansContract,
)
from implementation.ast.protocols import PythonCallableStatementsContract
from implementation.references.protocols import (
    PythonScopedTypeAliasesContract,
)


class PythonAstTreeDependencies:
    """Responsibilities: _AST service assembly_, _tree dependency access_."""

    _callable_statements: PythonCallableStatementsContract
    _type_aliases: PythonScopedTypeAliasesContract
    _module_constants: PythonModuleConstantSpansContract

    def __init__(
        self, tree: ast.Module, node_index: PythonAstNodeIndexContract
    ) -> None:
        """Responsibilities: _tree dependency initialization_."""
        self._callable_statements: PythonCallableStatementsContract = (
            CallableStatements()
        )
        self._type_aliases: PythonScopedTypeAliasesContract = PythonScopedTypeAliases(
            tree, node_index
        )
        self._module_constants: PythonModuleConstantSpansContract = (
            PythonModuleConstantSpans(tree)
        )

    def callable_statements(self) -> PythonCallableStatementsContract:
        """Responsibilities: _callable statement access_."""
        return self._callable_statements

    def type_aliases(self) -> PythonScopedTypeAliasesContract:
        """Responsibilities: _type alias access_."""
        return self._type_aliases

    def module_constants(self) -> PythonModuleConstantSpansContract:
        """Responsibilities: _module constant access_."""
        return self._module_constants
