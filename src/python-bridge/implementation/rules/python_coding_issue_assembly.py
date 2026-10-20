from __future__ import annotations

from implementation.protocols import PythonProxyCallableAnalyzerContract
from implementation.rules.protocols import (
    PythonCodingIssueBoundaryStateContract,
    PythonCodingIssueComponentContextContract,
    PythonFieldMutationCollectorContract,
)
from implementation.rules.protocols import PythonPrimaryRulesContract
from implementation.rules.protocols import (
    PythonSingleItemArrayStateRulesContract,
    PythonUnnecessaryUndefinedCheckContract,
)
from implementation.rules.python_field_mutation_collector import (
    PythonFieldMutationCollector,
)
from implementation.references.aliases.python_reference_aliases import (
    PythonReferenceAliases,
)
from implementation.references.python_proxy_receiver_aliases import (
    PythonProxyReceiverAliases,
)
from implementation.rules.call_analysis.python_proxy_callable_analyzer import (
    PythonProxyCallableAnalyzer,
)
from implementation.rules.call_analysis.python_proxy_target import PythonProxyTarget
from implementation.rules.call_analysis.python_unnecessary_undefined_check import (
    PythonUnnecessaryUndefinedCheck,
)
from implementation.rules.undefined_check_state import UndefinedCheckState
from implementation.rules.coding_issues.python_coding_issue_boundary_state import (
    PythonCodingIssueBoundaryState,
)
from implementation.rules.coding_issues.python_coding_issue_structure_state import (
    PythonCodingIssueStructureState,
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
from implementation.rules.type_rules.python_coding_issue_type_state import (
    PythonCodingIssueTypeState,
)
from implementation.rules.types import (
    PythonCodingIssueAssemblyBundleContract,
    PythonCodingIssueBoundaryBundleContract,
    PythonCodingIssueStructureBundleContract,
    PythonCodingIssueTypeBundleContract,
)


class PythonCodingIssueAssembly:
    """Responsibilities: _rule dependency composition_, _issue stage assembly_."""

    _context: PythonCodingIssueComponentContextContract
    _primary: PythonPrimaryRulesContract

    def _field_mutations(self) -> PythonFieldMutationCollectorContract:
        """Responsibilities: _field mutation construction_."""
        context = self._context
        return PythonFieldMutationCollector(
            context.tree,
            context.node_index,
            context.field_container_aliases,
            context.reference_aliases,
        )

    def _proxy_analyzer(self) -> PythonProxyCallableAnalyzerContract:
        """Responsibilities: _proxy analyzer construction_."""
        context = self._context
        return PythonProxyCallableAnalyzer(
            context.tree,
            PythonProxyTarget(),
            PythonProxyReceiverAliases(context.tree),
        )

    def _undefined_check(self) -> PythonUnnecessaryUndefinedCheckContract:
        """Responsibilities: _undefined check construction_."""
        context = self._context
        aliases = PythonReferenceAliases()
        builder = UndefinedCheckState({}, {}, aliases)
        state = UndefinedCheckState(
            builder.bindings_for(context.tree),
            builder.fields_for(context.tree),
            aliases,
        )
        return PythonUnnecessaryUndefinedCheck(context.tree, state)

    def _boundary_state(self) -> PythonCodingIssueBoundaryStateContract:
        """Responsibilities: _boundary state construction_."""
        return PythonCodingIssueBoundaryState(
            self._field_mutations(),
            self._proxy_analyzer(),
            self._undefined_check(),
        )

    def _type_bundle(self) -> PythonCodingIssueTypeBundleContract:
        """Responsibilities: _type bundle construction_."""
        type_state = PythonCodingIssueTypeState(self._context)
        return PythonCodingIssueTypeBundleContract(
            type_state.union_rules(),
            type_state.unbounded_rules(),
        )

    def _boundary_bundle(self) -> PythonCodingIssueBoundaryBundleContract:
        """Responsibilities: _boundary bundle construction_."""
        boundary_state = self._boundary_state()
        return PythonCodingIssueBoundaryBundleContract(
            boundary_state.field_mutations(),
            boundary_state.proxy_analyzer(),
            boundary_state.unnecessary_undefined_check(),
        )

    def _structure_bundle(self) -> PythonCodingIssueStructureBundleContract:
        """Responsibilities: _structure bundle construction_."""
        context = self._context
        structure = PythonCodingIssueStructureState(
            context, self._primary.decorator_rules
        )
        return PythonCodingIssueStructureBundleContract(
            structure.tests().subtest_aliases(),
            structure.flow().control_flow(),
            structure.flow().precedence(),
            structure.tests().simple_stages(),
            context.node_index.nodes(context.tree),
            structure.tests().test_order(),
        )

    def __init__(
        self,
        context: PythonCodingIssueComponentContextContract,
        primary: PythonPrimaryRulesContract,
    ) -> None:
        """Responsibilities: _coding issue dependency initialization_."""
        self._context: PythonCodingIssueComponentContextContract = context
        self._primary: PythonPrimaryRulesContract = primary

    def array_rules(self) -> PythonSingleItemArrayStateRulesContract:
        """Responsibilities: _array rule dependencies_."""
        context = self._context
        analyzer = PythonArrayCallAnalyzer(
            PythonArrayCallOptions(
                context.tree,
                context.node_index,
                PythonArrayTypeInspector(frozenset({"list", "List"})),
                PythonReturnArrayAnalyzer(),
                PythonReferenceAliases(),
            )
        )
        return PythonSingleItemArrayStateRules(
            context.tree, context.node_index, analyzer
        )

    def assemble(self) -> PythonCodingIssueAssemblyBundleContract:
        """Responsibilities: _coding issue dependency composition_."""
        return PythonCodingIssueAssemblyBundleContract(
            self._type_bundle(),
            self._boundary_bundle(),
            self._structure_bundle(),
            self.array_rules(),
        )
