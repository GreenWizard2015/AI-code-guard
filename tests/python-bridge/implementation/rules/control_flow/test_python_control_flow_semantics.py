import ast
import unittest

from implementation.ast.imports.python_ast_node_index import PythonAstNodeIndex
from implementation.ast.imports.source_segments import SourceSegments
from implementation.rules.control_flow.protocols import (
    PythonControlFlowIssuesContract,
    PythonControlFlowOptionsContract,
)
from implementation.rules.control_flow.python_control_flow_issues import PythonControlFlowIssues
from implementation.rules.control_flow.python_terminal_branch_rules import PythonTerminalBranchRules
from implementation.rules.control_flow.types import PythonControlFlowOptions
from implementation.types import JsonObject


class PythonControlFlowSemanticsTest(unittest.TestCase):
    """Responsibilities: _conditional expression diagnostics_, _logical expression diagnostics_."""

    def _options(self, source: str) -> PythonControlFlowOptionsContract:
        """Responsibilities: _conditional source analysis_."""
        tree = ast.parse(source)
        return PythonControlFlowOptions(
            tree,
            source.splitlines(),
            set(),
            PythonAstNodeIndex(),
            PythonTerminalBranchRules(),
            SourceSegments(source),
        )

    def _issues(self, source: str, control: PythonControlFlowIssuesContract) -> list[JsonObject]:
        """Responsibilities: _conditional issue collection_."""
        tree = ast.parse(source)
        return [issue for node in ast.walk(tree) for issue in control.conditional_issues(node)]

    def test_rejects_boolean_identity_return_hacks(self) -> None:
        """Responsibilities: _boolean identity diagnostics_."""
        source = (
            "def check(value: bool) -> None:\n"
            "    if value is True:\n"
            "        return\n"
            "    if value is False:\n"
            "        return\n"
        )
        self.assertEqual(
            [
                issue["kind"]
                for issue in self._issues(source, PythonControlFlowIssues(self._options(source)))
                if issue["kind"] == "pointless-boolean-operation"
            ],
            ["pointless-boolean-operation", "pointless-boolean-operation"],
        )

    def test_preserves_identity_check_for_mapping_values(self) -> None:
        """Responsibilities: _mapping identity preservation_."""
        source = (
            "def is_error(result: dict[str, object]) -> bool:\n"
            '    if result.get("isError") is True:\n'
            "        return True\n"
            "    return False\n"
        )
        self.assertEqual(
            [
                issue
                for issue in self._issues(source, PythonControlFlowIssues(self._options(source)))
                if issue["kind"] == "pointless-boolean-operation"
            ],
            [],
        )

    def test_reports_long_single_line_logical_chain(self) -> None:
        """Responsibilities: _logical chain diagnostics_."""
        source = "def check(a, b, c, d):\n    return a and b and c and d\n"
        issues = self._issues(source, PythonControlFlowIssues(self._options(source)))
        self.assertEqual([issue["kind"] for issue in issues], ["logical-chain-size"])

    def test_reports_ternary_expression(self) -> None:
        """Responsibilities: _ternary diagnostics_."""
        source = "def choose(flag, first, second):\n    return first if flag else second\n"
        issues = self._issues(source, PythonControlFlowIssues(self._options(source)))
        self.assertEqual([issue["kind"] for issue in issues], ["ternary-expression"])

    def test_reports_unknown_calls_without_name_based_exceptions(self) -> None:
        """Responsibilities: _conditional call diagnostics_."""
        source = (
            "def _is_receiver(value):\n"
            "    return True\n"
            "def check(arguments):\n"
            "    return len(arguments) == 1 and not _is_receiver(arguments[0])\n"
            "def run(ready):\n"
            "    return ready and perform_action()\n"
            "def verify(ready):\n"
            "    return ready and ready.perform()\n"
            "def compute(ready):\n"
            "    return ready and _compute_value()\n"
        )
        self.assertEqual(
            [
                issue["kind"]
                for issue in self._issues(source, PythonControlFlowIssues(self._options(source)))
                if issue["kind"] == "conditional-execution"
            ],
            ["conditional-execution"] * 4,
        )
