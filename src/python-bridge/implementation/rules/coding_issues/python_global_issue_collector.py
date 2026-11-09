from __future__ import annotations

import ast
from collections.abc import Iterator
from contextlib import contextmanager
from time import perf_counter

from implementation.rules.call_analysis.concrete_collaborator_creation import (
    ConcreteCollaboratorCreation,
)
from implementation.rules.call_analysis.testing.python_unasserted_async_completion import (
    PythonUnassertedAsyncCompletion,
)
from implementation.rules.coding_issues.python_duplicate_error_translation import (
    PythonDuplicateErrorTranslation,
)
from implementation.rules.coding_issues.python_hidden_global_state_rules import (
    PythonHiddenGlobalStateRules,
)
from implementation.rules.coding_issues.python_runtime_patching import (
    PythonRuntimePatching,
)
from implementation.rules.control_flow.python_retry_without_ownership import (
    PythonRetryWithoutOwnership,
)
from implementation.rules.control_flow.python_temporal_coupling import (
    PythonTemporalCoupling,
)
from implementation.rules.finite_variants.finite_variant_mapping import (
    FiniteVariantMapping,
)
from implementation.rules.protocols import (
    PythonCodingIssueComponentContextContract,
    PythonModuleIssueRuleContract,
)
from implementation.types import JsonObject


class PythonGlobalIssueCollector:
    """Responsibilities: _collection rule analysis_, _state rule analysis_."""

    _timings: dict[str, float]

    @contextmanager
    def _measure(self, name: str) -> Iterator[None]:
        """Responsibilities: _global rule stage timing_."""
        started = perf_counter()
        try:
            yield
        finally:
            self._timings.update({name: (perf_counter() - started) * 1000})

    def _module_tree(self) -> ast.Module:
        """Responsibilities: _module syntax access_."""
        tree = self._context.tree()
        if type(tree) is not ast.Module:
            raise TypeError("Rule analysis requires a module tree")
        return tree

    def _finite_variant_issues(self) -> list[JsonObject]:
        """Responsibilities: _finite variant analysis_."""
        with self._measure("rule.finite-variant-mapping-is-incomplete"):
            with self._measure("rule.finite-variant-mapping-is-incomplete.prepare"):
                rule = FiniteVariantMapping(self._module_tree(), self._context.node_index())
                rule.prepare()
            with self._measure("rule.finite-variant-mapping-is-incomplete.analysis"):
                return rule.issues()

    def _collaborator_creation_issues(self) -> list[JsonObject]:
        """Responsibilities: _collaborator creation analysis_."""
        with self._measure("rule.concrete-collaborator-created-per-operation"):
            with self._measure("rule.concrete-collaborator-created-per-operation.prepare"):
                rule = ConcreteCollaboratorCreation(self._module_tree(), self._context.node_index())
                rule.prepare()
            with self._measure("rule.concrete-collaborator-created-per-operation.analysis"):
                return rule.issues()

    def _global_state_issues(self) -> list[JsonObject]:
        """Responsibilities: _global state analysis_."""
        with self._measure("rule.hidden-global-state"):
            rule = PythonHiddenGlobalStateRules(self._context.node_index())
            return rule.issues(self._module_tree())

    def _runtime_patching_issues(self) -> list[JsonObject]:
        """Responsibilities: _runtime patch prohibition analysis_."""
        with self._measure("rule.runtime-patching"):
            with self._measure("rule.runtime-patching.prepare"):
                rule = PythonRuntimePatching(self._module_tree(), self._context.node_index())
            with self._measure("rule.runtime-patching.analysis"):
                return rule.issues()

    def _state_rule_analyzers(self) -> dict[str, PythonModuleIssueRuleContract]:
        """Responsibilities: _state rule selection_."""
        index = self._context.node_index()
        temporal_coupling = PythonTemporalCoupling(index)
        error_translation = PythonDuplicateErrorTranslation(index)
        async_completion = PythonUnassertedAsyncCompletion(index)
        retry_ownership = PythonRetryWithoutOwnership(index)
        return {
            "temporal-coupling": temporal_coupling,
            "duplicate-error-translation": error_translation,
            "unasserted-async-completion": async_completion,
            "retry-without-ownership": retry_ownership,
        }

    def __init__(self, context: PythonCodingIssueComponentContextContract) -> None:
        """Responsibilities: _project rule context ownership_."""
        self._context: PythonCodingIssueComponentContextContract = context
        self._timings = {}

    def collection_issues(self) -> list[JsonObject]:
        """Responsibilities: _collection rule diagnostics_."""
        issues = self._finite_variant_issues()
        issues.extend(self._collaborator_creation_issues())
        issues.extend(self._global_state_issues())
        issues.extend(self._runtime_patching_issues())
        return issues

    def state_issues(self) -> list[JsonObject]:
        """Responsibilities: _state rule diagnostics_."""
        tree = self._module_tree()
        issues: list[JsonObject] = []
        for name, rule in self._state_rule_analyzers().items():
            with self._measure(f"rule.{name}"):
                issues.extend(rule.issues(tree))
        return issues

    def timings_data(self) -> dict[str, float]:
        """Responsibilities: _global rule timing access_."""
        return dict(self._timings.items())
