from __future__ import annotations

from implementation.protocols import PythonAstNodeIndexContract
from implementation.references.protocols import (
    PythonCallReturnStateContract,
    PythonReferenceSymbolTablesContract,
)


class PythonReferenceContextOptions:
    """Responsibilities: _reference tables_, _AST services_."""

    _symbol_tables: PythonReferenceSymbolTablesContract
    _call_return_state: PythonCallReturnStateContract
    _node_index: PythonAstNodeIndexContract

    def __init__(
        self,
        symbol_tables: PythonReferenceSymbolTablesContract,
        call_return_state: PythonCallReturnStateContract,
        node_index: PythonAstNodeIndexContract,
    ) -> None:
        """Responsibilities: _reference configuration storage_."""
        self._symbol_tables: PythonReferenceSymbolTablesContract = symbol_tables
        self._call_return_state: PythonCallReturnStateContract = call_return_state
        self._node_index: PythonAstNodeIndexContract = node_index

    def symbol_tables(self) -> PythonReferenceSymbolTablesContract:
        """Responsibilities: _reference table dependency_."""
        return self._symbol_tables

    def call_return_values(self) -> PythonCallReturnStateContract:
        """Responsibilities: _callable output state_."""
        return self._call_return_state

    def ast_index(self) -> PythonAstNodeIndexContract:
        """Responsibilities: _AST node index dependency_."""
        return self._node_index
