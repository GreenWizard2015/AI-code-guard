from __future__ import annotations

import unittest

from implementation.ast.python_ast_tree import PythonAstTree


class SharedStateRegressionTest(unittest.TestCase):
    """Responsibilities: _test state ownership_, _descriptor class identity_."""

    def test_same_test_mutations_do_not_create_cross_test_dependency(self) -> None:
        """Responsibilities: _test state participant identity_."""
        source = """
shared = []
def test_state():
    shared.append(1)
    shared.append(2)
"""
        tree = PythonAstTree(source)
        issues = [issue["kind"] for issue in tree.coding_issues()]

        self.assertNotIn("test-order-dependency", issues)

    def test_aliases_of_shared_module_state_track_the_same_object(self) -> None:
        """Responsibilities: _shared alias identity_."""
        source = """
shared = []
alias = shared
def test_first():
    alias.append(1)

def test_second():
    shared.append(2)
"""
        tree = PythonAstTree(source)
        issues = [issue["kind"] for issue in tree.coding_issues()]

        self.assertIn("test-order-dependency", issues)

    def test_fresh_local_collections_are_not_module_shared_state(self) -> None:
        """Responsibilities: _local collection ownership_."""
        source = """
shared = []
def test_first():
    shared = []
    shared.append(1)

def test_second():
    shared = []
    shared.append(2)
"""
        tree = PythonAstTree(source)
        issues = [issue["kind"] for issue in tree.coding_issues()]

        self.assertNotIn("test-order-dependency", issues)

    def test_equal_descriptor_names_in_different_classes_remain_distinct(self) -> None:
        """Responsibilities: _descriptor class ownership_."""
        source = """
class First:
    def run(self):
        return 1
    run = staticmethod(run)

class Second:
    def run(self):
        return 2
"""
        tree = PythonAstTree(source)
        issues = [issue for issue in tree.coding_issues() if issue["kind"] == "python-static-method"]

        self.assertEqual([issue["line"] for issue in issues], [2])

    def test_descriptor_identity_is_class_local_and_invalidated_on_reassignment(self) -> None:
        """Responsibilities: _descriptor ownership_, _descriptor replacement_."""
        source = """
def run(self):
    return 0

class Outer:
    def run(self):
        return 1
    run = staticmethod(run)
    run = wrap(run)

    class Inner:
        def run(self):
            return 2
"""
        tree = PythonAstTree(source)
        issues = [issue for issue in tree.coding_issues() if issue["kind"] == "python-static-method"]

        self.assertEqual(issues, [])
