from __future__ import annotations

import ast
from dataclasses import dataclass
from functools import cached_property
from typing import Any

from implementation.ast.callables.coding_issue_options import (
    PythonCodingIssueAliases,
    PythonCodingIssueCollectorOptions,
    PythonCodingIssueContainerAliases,
    PythonCodingIssueRules,
    PythonCodingIssueSource,
    PythonCodingIssueValueAliases,
)
from implementation.ast.protocols import (
    PythonAstNodeIndexContract,
    PythonSourceSegmentsContract,
)
from implementation.rules.protocols import (
    PythonCodingIssueAliasesContract,
    PythonCodingIssueOptionsContract,
    PythonCodingIssueSourceContract,
)
from implementation.ast.callables.python_coding_issue_collector import (
    PythonCodingIssueCollector,
)
from implementation.references.protocols import (
    PythonContainerAliasesContract,
    PythonContainerKeysContract,
    PythonContainerValuesContract,
    PythonReferenceAliasesContract,
    PythonScopedTypeAliasesContract,
)
from implementation.references.aliases.python_container_assembly import (
    PythonContainerAssembly,
)
from implementation.rules.control_flow.python_expression_boundary import (
    PythonExpressionBoundary,
)
from implementation.rules.control_flow.python_predicate_condition import (
    PythonPredicateCondition,
)
from implementation.rules.control_flow.python_terminal_branch_rules import (
    PythonTerminalBranchRules,
)
from implementation.rules.python_coding_issue_component_context import (
    PythonCodingIssueComponentContext,
)
from implementation.rules.python_coding_issue_components import (
    PythonCodingIssueComponents,
)
from implementation.rules.python_coding_issue_primary_rules import (
    PythonCodingIssuePrimaryRules,
)
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

    def _source(self) -> PythonCodingIssueSourceContract:
        """Responsibilities: _coding issue source assembly_."""
        inputs = self._inputs
        return PythonCodingIssueSource(
            inputs.tree,
            inputs.source,
            inputs.source_segments,
            inputs.node_index,
            PythonExpressionBoundary(inputs.source_segments),
        )

    def _aliases(self) -> PythonCodingIssueAliasesContract:
        """Responsibilities: _coding issue alias assembly_."""
        inputs = self._inputs
        assemblies = [PythonContainerAssembly(inputs.node_index) for _ in range(8)]
        aliases = [assembly.container_aliases() for assembly in assemblies]
        return PythonCodingIssueAliases(
            PythonCodingIssueContainerAliases(
                inputs.container_aliases,
                aliases[0],
                aliases[1],
                aliases[2],
                aliases[3],
                aliases[4],
                aliases[5],
                aliases[6],
                aliases[7],
            ),
            PythonCodingIssueValueAliases(
                inputs.container_values,
                inputs.container_keys,
                inputs.type_aliases,
                inputs.reference_aliases,
            ),
        )

    def _options(self) -> PythonCodingIssueOptionsContract:
        """Responsibilities: _coding issue options assembly_."""
        return PythonCodingIssueCollectorOptions(
            self._source(),
            self._aliases(),
            PythonCodingIssueRules(
                PythonTerminalBranchRules(),
                PythonPredicateCondition(),
            ),
        )

    @cached_property
    def _result(self) -> PythonAstCodingIssueResult:
        """Responsibilities: _coding issue collection_."""
        collector_options = self._options()
        context = PythonCodingIssueComponentContext(collector_options)
        primary = PythonCodingIssuePrimaryRules(context)
        components = PythonCodingIssueComponents(context, primary)
        collector: PythonCodingIssueCollector = PythonCodingIssueCollector(
            components,
            components.rule_stages(),
            components.source_nodes(),
            components.proxy_analysis,
        )
        issues: Any = collector.collect()
        issues = [{**issue, "name": issue.get("name", "")} for issue in issues]
        return PythonAstCodingIssueResult(issues, collector.timing.durations())

    def __init__(self, inputs: PythonAstCodingIssueInputs) -> None:
        """Responsibilities: _coding issue inputs_."""
        self._inputs: PythonAstCodingIssueInputs = inputs

    def issues(self) -> list[JsonObject]:
        """Responsibilities: _Python coding issues_."""
        return self._result.issues

    def timings_data(self) -> dict[str, float]:
        """Responsibilities: _coding issue timings_."""
        return self._result.timings
