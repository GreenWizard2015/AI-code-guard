from __future__ import annotations

import ast

from implementation.references.aliases.python_container_aliases import (
    PythonContainerAliases,
)
from implementation.rules.control_flow.python_expression_boundary import (
    PythonExpressionBoundary,
)
from implementation.ast.callables.scoped_type_aliases import PythonScopedTypeAliases
from implementation.ast.imports.source_segments import SourceSegments
from implementation.rules.control_flow.python_terminal_branch_rules import (
    PythonTerminalBranchRules,
)
from implementation.ast.callables.python_coding_issue_collector import (
    PythonCodingIssueCollector,
)
from implementation.rules.python_coding_issue_components import (
    PythonCodingIssueComponents,
)
from implementation.rules.python_coding_issue_primary_rules import (
    PythonCodingIssuePrimaryRules,
)
from implementation.rules.python_coding_issue_component_context import (
    PythonCodingIssueComponentContext,
)
from python_collector_fixture_factory import PythonCollectorFixtureOptionsFactory


class PythonCollectorFixture:
    """Responsibilities: _collector fixture setup_, _collector instance construction_."""

    """Responsibilities: _Python coding collector fixtures_."""

    options_factory: PythonCollectorFixtureOptionsFactory

    def __init__(self) -> None:
        """Responsibilities: _collector fixture initialization_."""
        self.options_factory: PythonCollectorFixtureOptionsFactory = (
            PythonCollectorFixtureOptionsFactory()
        )

    def collector(self, tree: ast.AST, source: str) -> PythonCodingIssueCollector:
        """Responsibilities: _coding collector construction_."""
        options = self.options_factory.create(tree, source)
        context = PythonCodingIssueComponentContext(options)
        primary = PythonCodingIssuePrimaryRules(context)
        components = PythonCodingIssueComponents(context, primary)
        return PythonCodingIssueCollector(
            components,
            components.rule_stages(),
            components.source_nodes,
            components.proxy_analysis,
        )
