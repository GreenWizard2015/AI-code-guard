from __future__ import annotations

import ast
from dataclasses import dataclass
from functools import cached_property
from time import perf_counter

from implementation.ast.callables.coding_issue_aliases import (
    PythonCodingIssueAliases,
    PythonCodingIssueContainerAliases,
    PythonCodingIssueValueAliases,
)
from implementation.ast.callables.coding_issue_options import (
    PythonCodingIssueCollectorOptions,
    PythonCodingIssueRules,
    PythonCodingIssueSource,
)
from implementation.ast.callables.coding_issue_protocols import (
    PythonCodingIssueCollectorContract,
    PythonCodingIssueContainerAliasesContract,
    PythonCodingIssueValueAliasesContract,
)
from implementation.ast.callables.python_coding_issue_collector import (
    PythonCodingIssueCollector,
)
from implementation.ast.protocols import (
    PythonAstNodeIndexContract,
    PythonSourceSegmentsContract,
)
from implementation.references.aliases.python_container_assembly import (
    PythonContainerAssembly,
)
from implementation.references.protocols import (
    PythonContainerAliasesContract,
    PythonContainerKeysContract,
    PythonContainerValuesContract,
    PythonReferenceAliasesContract,
    PythonScopedTypeAliasesContract,
)
from implementation.rules.coding_issues.python_coding_issue_component_context import (
    PythonCodingIssueComponentContext,
)
from implementation.rules.coding_issues.python_coding_issue_components import (
    PythonCodingIssueComponents,
)
from implementation.rules.coding_issues.python_coding_issue_primary_rules import (
    PythonCodingIssuePrimaryRules,
)
from implementation.rules.control_flow.python_terminal_branch_rules import (
    PythonTerminalBranchRules,
)
from implementation.rules.protocols import (
    PythonCodingIssueAliasesContract,
    PythonCodingIssueComponentsContract,
    PythonCodingIssueOptionsContract,
    PythonCodingIssueSourceContract,
)
from implementation.rules.python_syntax.python_primary_type_assembly import PythonPrimaryTypeAssembly
from implementation.types import JsonObject


@dataclass(frozen=True)
class PythonAstCodingIssueInputs:
    """Responsibilities: _coding issue source inputs_, _reference analysis dependencies_."""

    tree: ast.Module
    source: str
    node_index: PythonAstNodeIndexContract
    source_segments: PythonSourceSegmentsContract
    container_aliases: PythonContainerAliasesContract
    container_values: PythonContainerValuesContract
    container_keys: PythonContainerKeysContract
    type_aliases: PythonScopedTypeAliasesContract
    reference_aliases: PythonReferenceAliasesContract


@dataclass(frozen=True)
class PythonAstCodingIssueResult:
    """Responsibilities: _coding issue diagnostics_, _analysis timing results_."""

    issues: list[JsonObject]
    timings: dict[str, float]


class PythonAstCodingIssues:
    """Responsibilities: _coding issue aggregation_, _rule component coordination_."""

    _inputs: PythonAstCodingIssueInputs
    _setup_durations: dict[str, float]

    def _source_options(self) -> PythonCodingIssueSourceContract:
        """Responsibilities: _coding issue source assembly_."""
        inputs = self._inputs
        return PythonCodingIssueSource(
            inputs.tree,
            inputs.source,
            inputs.source_segments,
            inputs.node_index,
        )

    def _container_aliases(self) -> PythonCodingIssueContainerAliasesContract:
        """Responsibilities: _rule-specific container alias assembly_."""
        inputs = self._inputs
        assemblies = [PythonContainerAssembly(inputs.node_index) for _ in range(8)]
        aliases = [assembly.container_aliases() for assembly in assemblies]
        return PythonCodingIssueContainerAliases(
            inputs.container_aliases,
            aliases[0],
            aliases[1],
            aliases[2],
            aliases[3],
            aliases[4],
            aliases[5],
            aliases[6],
            aliases[7],
        )

    def _value_aliases(self) -> PythonCodingIssueValueAliasesContract:
        """Responsibilities: _value alias assembly_."""
        inputs = self._inputs
        return PythonCodingIssueValueAliases(
            inputs.container_values,
            inputs.container_keys,
            inputs.type_aliases,
            inputs.reference_aliases,
        )

    def _alias_groups(self) -> PythonCodingIssueAliasesContract:
        """Responsibilities: _coding issue alias grouping_."""
        containers = self._container_aliases()
        values = self._value_aliases()
        return PythonCodingIssueAliases(containers, values)

    def _options(self) -> PythonCodingIssueOptionsContract:
        """Responsibilities: _coding issue options assembly_."""
        started = perf_counter()
        options = PythonCodingIssueCollectorOptions(
            self._source_options(),
            self._alias_groups(),
            PythonCodingIssueRules(PythonTerminalBranchRules()),
        )
        self._setup_durations.update({"setup.options": (perf_counter() - started) * 1000})
        return options

    def _components(
        self,
        collector_options: PythonCodingIssueOptionsContract,
    ) -> PythonCodingIssueComponentsContract:
        """Responsibilities: _coding issue component assembly_."""
        started = perf_counter()
        context = PythonCodingIssueComponentContext(collector_options)
        primary_assembly = PythonPrimaryTypeAssembly(context)
        rule_set = primary_assembly.primary_rule_set()
        primary = PythonCodingIssuePrimaryRules(context, rule_set)
        components = PythonCodingIssueComponents(context, primary)
        self._setup_durations.update({"setup.components": (perf_counter() - started) * 1000})
        return components

    def _setup_collector(self) -> PythonCodingIssueCollectorContract:
        """Responsibilities: _timed coding issue assembly_."""
        options = self._options()
        components = self._components(options)
        started = perf_counter()
        collector = PythonCodingIssueCollector(components, components.execution_plan())
        self._setup_durations.update({"setup.collector": (perf_counter() - started) * 1000})
        for name, duration in self._setup_durations.items():
            collector.timing().add_duration(name, duration)
        return collector

    @cached_property
    def _result(self) -> PythonAstCodingIssueResult:
        """Responsibilities: _coding issue collection_."""
        collector = self._setup_collector()
        issues = collector.collect()
        with collector.timing().measure("issue-normalization"):
            normalized_issues = [{**issue, "name": issue.get("name", "")} for issue in issues]
        return PythonAstCodingIssueResult(
            normalized_issues,
            collector.timing().durations(),
        )

    def __init__(self, inputs: PythonAstCodingIssueInputs) -> None:
        """Responsibilities: _coding issue inputs_."""
        self._inputs: PythonAstCodingIssueInputs = inputs
        self._setup_durations = {}

    def issues(self) -> list[JsonObject]:
        """Responsibilities: _Python coding issues_."""
        return self._result.issues

    def timings_data(self) -> dict[str, float]:
        """Responsibilities: _coding issue timings_."""
        return self._result.timings
