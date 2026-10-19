import unittest

from implementation.ast.python_ast_tree import PythonAstTree
from tests.python.constants import (
    ANNOTATED_CLASS_ALIAS_SOURCE,
    LOCAL_CLASS_ALIAS_SOURCE,
    REPEATED_CALL_SOURCE,
)


class PythonCallRulesTest(unittest.TestCase):
    """Responsibilities: _alias rules_, _rule diagnostics_."""

    """Responsibilities: _Python alias rules_."""

    def test_annotated_class_init_alias(self) -> None:
        """Responsibilities: _annotated class initializer aliases_."""
        parser = PythonAstTree(ANNOTATED_CLASS_ALIAS_SOURCE)
        issues = parser.coding_issues()

        self.assertEqual(sum(issue["kind"] == "python-direct-class-init" for issue in issues), 1)

    def test_local_class_init_alias(self) -> None:
        """Responsibilities: _local class initializer aliases_."""
        parser = PythonAstTree(LOCAL_CLASS_ALIAS_SOURCE)
        issues = parser.coding_issues()

        self.assertEqual(sum(issue["kind"] == "python-direct-class-init" for issue in issues), 2)

    def test_repeated_analysis_preserves_call_issues(self) -> None:
        """Responsibilities: _issue stability_."""
        parser = PythonAstTree(REPEATED_CALL_SOURCE)
        first = parser.coding_issues()
        second = parser.coding_issues()

        self.assertEqual(second, first)
