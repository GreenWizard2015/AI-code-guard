import ast
import unittest

from implementation.rules.python_repeated_branch_analysis import (
    PythonRepeatedBranchAnalysis,
)


class PythonRepeatedBranchAnalysisTest(unittest.TestCase):
    """Responsibilities: _repeated comparison detection_, _branch identity checks_."""

    def test_reports_chain_comparing_the_same_name(self) -> None:
        """Responsibilities: _same-name comparison diagnostics_."""
        tree = ast.parse(
            "if state == 'ready':\n    pass\nelif state == 'running':\n    pass\n",
        )
        analysis = PythonRepeatedBranchAnalysis(list(ast.walk(tree)))
        summaries = analysis.branch_summaries()
        issues = analysis.repeated_results(summaries)
        self.assertEqual([issue["line"] for issue in issues], [0])

    def test_ignores_chain_comparing_different_names(self) -> None:
        """Responsibilities: _different-name comparison exclusion_."""
        tree = ast.parse(
            "if state == 'ready':\n    pass\nelif phase == 'running':\n    pass\n",
        )
        analysis = PythonRepeatedBranchAnalysis(list(ast.walk(tree)))
        summaries = analysis.branch_summaries()
        self.assertEqual(analysis.repeated_results(summaries), [])
