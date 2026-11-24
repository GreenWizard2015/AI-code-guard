import ast
import unittest

from implementation.rules.control_flow.python_type_check_issue_stage import PythonTypeCheckIssueStage


class PythonTypeCheckIssueStageTests(unittest.TestCase):
    """Responsibilities: _type probe tests_, _ordinary access tests_."""

    def test_finds_runtime_type_probes_in_function_body(self) -> None:
        """Responsibilities: _runtime type probe findings_."""
        tree = ast.parse(
            "def test_value(value):\n"
            "    isinstance(value, str)\n"
            "    type(value) is str\n"
            "    match value:\n"
            "        case str(): pass\n"
        )
        function = tree.body[0]
        stage = PythonTypeCheckIssueStage()
        issues = stage.type_check_issues(function.body)

        self.assertEqual(
            issues,
            [
                {"line": 1, "kind": "test-type-check"},
                {"line": 2, "kind": "test-type-check"},
                {"line": 4, "kind": "test-type-check"},
            ],
        )

    def test_ignores_ordinary_named_access(self) -> None:
        """Responsibilities: _ordinary access classification_."""
        tree = ast.parse("def test_value(value):\n    value.name\n")
        function = tree.body[0]
        stage = PythonTypeCheckIssueStage()

        self.assertEqual(stage.type_check_issues(function.body), [])
