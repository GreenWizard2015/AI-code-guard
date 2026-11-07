from __future__ import annotations

import ast

from implementation.references.aliases.python_reference_aliases import (
    PythonReferenceAliases,
    PythonReferenceAliasState,
)
from implementation.rules.protocols import (
    PythonCodingIssueComponentContextContract,
)
from implementation.rules.single_item_array_state.call_analysis import (
    PythonArrayCallAnalyzer,
    PythonArrayCallOptions,
)
from implementation.rules.single_item_array_state.python_array_type_inspector import (
    PythonArrayTypeInspector,
)
from implementation.rules.single_item_array_state.python_return_array_analyzer import (
    PythonReturnArrayAnalyzer,
)
from implementation.rules.single_item_array_state.python_single_item_array_state_rules import (
    PythonSingleItemArrayStateRules,
)
from implementation.rules.type_rule_protocols import (
    PythonArrayCallAnalyzerContract,
    PythonSingleItemArrayStateRulesContract,
)
from implementation.types import PythonAstCallableDeclarations


class PythonCodingIssueArrayState:
    """Responsibilities: _array callable indexing_, _array call analysis_, _array rule state_."""

    _context: PythonCodingIssueComponentContextContract

    def __init__(self, context: PythonCodingIssueComponentContextContract) -> None:
        """Responsibilities: _array source context ownership_."""
        self._context: PythonCodingIssueComponentContextContract = context

    def callable_declarations(self) -> PythonAstCallableDeclarations:
        """Responsibilities: _callable declaration indexing_."""
        context = self._context
        declarations_by_name: PythonAstCallableDeclarations = {}
        for node in context.node_index().nodes(context.tree()):
            if type(node) is ast.FunctionDef or type(node) is ast.AsyncFunctionDef:
                callable_name = node.name
            else:
                continue
            declarations = declarations_by_name.setdefault(callable_name, [])
            declarations.append(node)
        return declarations_by_name

    def rules(self) -> PythonSingleItemArrayStateRulesContract:
        """Responsibilities: _array rule assembly_."""
        context = self._context
        declarations = self.callable_declarations()
        analyzer: PythonArrayCallAnalyzerContract = PythonArrayCallAnalyzer(
            PythonArrayCallOptions(
                context.tree(),
                context.node_index(),
                PythonArrayTypeInspector(frozenset({"list", "List"})),
                PythonReturnArrayAnalyzer(),
                PythonReferenceAliases(PythonReferenceAliasState()),
                declarations,
            ),
        )
        return PythonSingleItemArrayStateRules(
            context.tree(),
            context.node_index(),
            analyzer,
        )
