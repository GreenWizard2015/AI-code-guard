from __future__ import annotations

from implementation.rules.coding_issues.primary_rule_protocols import PythonPrimaryRulesContract
from implementation.rules.coding_issues.states.python_coding_issue_array_state import (
    PythonCodingIssueArrayState,
)
from implementation.rules.coding_issues.states.python_coding_issue_boundary_state import (
    PythonCodingIssueBoundaryState,
)
from implementation.rules.coding_issues.states.python_coding_issue_structure_state import (
    PythonCodingIssueStructureState,
)
from implementation.rules.protocols import (
    PythonCodingIssueAssemblyBundleContract,
    PythonCodingIssueComponentContextContract,
)
from implementation.rules.type_rule_protocols import (
    PythonSingleItemArrayStateRulesContract,
)
from implementation.rules.type_rules.python_coding_issue_type_state import (
    PythonCodingIssueTypeState,
)
from implementation.rules.types import PythonCodingIssueAssemblyBundle


class PythonCodingIssueAssembly:
    """Responsibilities: _coding issue dependency composition_, _array rule composition_."""

    _context: PythonCodingIssueComponentContextContract
    _primary: PythonPrimaryRulesContract

    def __init__(
        self,
        context: PythonCodingIssueComponentContextContract,
        primary: PythonPrimaryRulesContract,
    ) -> None:
        """Responsibilities: _coding issue assembly inputs_."""
        self._context: PythonCodingIssueComponentContextContract = context
        self._primary: PythonPrimaryRulesContract = primary

    def array_rules(self) -> PythonSingleItemArrayStateRulesContract:
        """Responsibilities: _array rule creation_."""
        array_state = PythonCodingIssueArrayState(self._context)
        return array_state.rules()

    def assemble(self) -> PythonCodingIssueAssemblyBundleContract:
        """Responsibilities: _ordered coding issue dependencies_."""
        type_state = PythonCodingIssueTypeState(self._context)
        type_bundle = type_state.bundle()
        boundary_state = PythonCodingIssueBoundaryState(self._context)
        boundary_bundle = boundary_state.bundle()
        primary_rules = self._primary.rule_set()
        structure_state = PythonCodingIssueStructureState(
            self._context,
            primary_rules.decorator_rules,
        )
        structure_bundle = structure_state.bundle()
        array_rules = self.array_rules()
        return PythonCodingIssueAssemblyBundle(
            type_bundle,
            boundary_bundle,
            structure_bundle,
            array_rules,
        )
