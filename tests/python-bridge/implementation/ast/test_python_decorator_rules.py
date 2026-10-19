import unittest

from implementation.ast.python_ast_tree import PythonAstTree
from tests.python.constants import BUILTIN_DECORATOR_ALIAS_SOURCE


class PythonDecoratorRulesTest(unittest.TestCase):
    """Responsibilities: _builtin decorator recognition_, _decorator alias resolution_."""

    """Responsibilities: _Python decorator rules_."""

    def test_recognizes_static_method_aliases(self) -> None:
        """Responsibilities: _static decorator alias result_."""
        tree = PythonAstTree(BUILTIN_DECORATOR_ALIAS_SOURCE)
        kinds = [issue["kind"] for issue in tree.coding_issues()]

        self.assertIn("python-static-method", kinds)

    def test_recognizes_class_method_aliases(self) -> None:
        """Responsibilities: _class decorator alias result_."""
        tree = PythonAstTree(BUILTIN_DECORATOR_ALIAS_SOURCE)
        kinds = [issue["kind"] for issue in tree.coding_issues()]

        self.assertEqual(kinds.count("python-class-method"), 3)
