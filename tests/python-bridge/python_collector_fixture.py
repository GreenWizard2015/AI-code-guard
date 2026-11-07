from __future__ import annotations

import ast

from implementation.ast.callables.python_coding_issue_collector import (
    PythonCodingIssueCollector,
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
from implementation.rules.python_syntax.python_primary_type_assembly import PythonPrimaryTypeAssembly
from python_collector_fixture_factory import PythonCollectorFixtureOptionsFactory


class PythonCollectorFixture:
    """Responsibilities: _collector fixture setup_, _collector instance construction_."""

    """Responsibilities: _Python coding collector fixtures_."""

    _options_factory: PythonCollectorFixtureOptionsFactory

    def __init__(self) -> None:
        """Responsibilities: _collector fixture initialization_."""
        self._options_factory: PythonCollectorFixtureOptionsFactory = PythonCollectorFixtureOptionsFactory()

    def collector(self, tree: ast.AST, source: str) -> PythonCodingIssueCollector:
        """Responsibilities: _coding collector construction_."""
        options = self._options_factory.create(tree, source)
        context = PythonCodingIssueComponentContext(options)
        primary_assembly = PythonPrimaryTypeAssembly(context)
        rule_set = primary_assembly.primary_rule_set()
        primary = PythonCodingIssuePrimaryRules(context, rule_set)
        components = PythonCodingIssueComponents(context, primary)
        return PythonCodingIssueCollector(components, components.execution_plan())
