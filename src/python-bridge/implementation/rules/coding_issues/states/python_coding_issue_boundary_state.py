from __future__ import annotations

import ast

from implementation.protocols import PythonProxyCallableAnalyzerContract
from implementation.references.aliases.python_reference_aliases import (
    PythonReferenceAliases,
    PythonReferenceAliasState,
)
from implementation.rules.call_analysis.proxy_call.python_proxy_callable_analyzer import (
    PythonProxyCallableAnalyzer,
)
from implementation.rules.call_analysis.proxy_call.python_proxy_callable_syntax import (
    PythonProxyCallableSyntax,
)
from implementation.rules.call_analysis.proxy_call.python_proxy_receiver_aliases import (
    PythonProxyReceiverAliases,
)
from implementation.rules.call_analysis.python_unnecessary_undefined_check import (
    PythonUnnecessaryUndefinedCheck,
)
from implementation.rules.coding_issues.states.python_field_mutation_collector import (
    PythonFieldMutationCollector,
)
from implementation.rules.coding_issues.states.undefined_check_state import (
    UndefinedCheckState,
)
from implementation.rules.protocols import (
    PythonCodingIssueBoundaryBundleContract,
    PythonCodingIssueComponentContextContract,
    PythonUnnecessaryUndefinedCheckContract,
)
from implementation.rules.types import PythonCodingIssueBoundaryBundle


class PythonCodingIssueBoundaryState:
    """Responsibilities: _field mutation collection_, _call boundary analysis_, _undefined checks_."""

    _context: PythonCodingIssueComponentContextContract

    def __init__(self, context: PythonCodingIssueComponentContextContract) -> None:
        """Responsibilities: _boundary source context ownership_."""
        self._context: PythonCodingIssueComponentContextContract = context

    def proxy_analyzer(self) -> PythonProxyCallableAnalyzerContract:
        """Responsibilities: _proxy-call analyzer creation_."""
        tree = self._context.tree()
        receiver_aliases = PythonProxyReceiverAliases(tree)
        callable_syntax = PythonProxyCallableSyntax(receiver_aliases)
        return PythonProxyCallableAnalyzer(callable_syntax)

    def unnecessary_undefined_check(self) -> PythonUnnecessaryUndefinedCheckContract:
        """Responsibilities: _undefined-check analyzer creation_."""
        tree = self._context.tree()
        match tree:
            case ast.Module():
                pass
            case _:
                raise TypeError("Undefined-check analysis requires a module tree")
        aliases = PythonReferenceAliases(PythonReferenceAliasState())
        node_index = self._context.node_index()
        binding_state = UndefinedCheckState({}, {}, aliases, node_index)
        bindings = binding_state.bindings_for(tree)
        fields = binding_state.fields_for(tree)
        undefined_check_state = UndefinedCheckState(bindings, fields, aliases, node_index)
        return PythonUnnecessaryUndefinedCheck(tree, undefined_check_state)

    def bundle(self) -> PythonCodingIssueBoundaryBundleContract:
        """Responsibilities: _boundary analyzer bundle assembly_."""
        field_mutations = PythonFieldMutationCollector()
        proxy_analyzer = self.proxy_analyzer()
        undefined_check = self.unnecessary_undefined_check()
        return PythonCodingIssueBoundaryBundle(
            field_mutations,
            proxy_analyzer,
            undefined_check,
        )
