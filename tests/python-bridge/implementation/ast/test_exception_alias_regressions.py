from __future__ import annotations

import unittest

from implementation.ast.python_ast_tree import PythonAstTree


class ExceptionAliasRegressionTest(unittest.TestCase):
    """Responsibilities: _exception alias identity_, _duplicate translation detection_."""

    def test_project_factory_named_tuple_is_not_typing_factory(self) -> None:
        """Responsibilities: _project callable origin_."""
        source = """
from domain.builders import NamedTuple as build
import domain.schema as schema
result = build("invoice", [])
result_type: schema.Tuple[int]
service.NamedTuple("invoice", [])
"""
        tree = PythonAstTree(source)
        issues = [issue["kind"] for issue in tree.coding_issues()]

        self.assertNotIn("python-type-factory", issues)
        self.assertNotIn("tuple-type", issues)

    def test_distinct_error_receivers_and_keywords_are_not_duplicates(self) -> None:
        """Responsibilities: _error translation identity_."""
        source = """
def handle():
    try:
        operation()
    except Exception as error:
        if use_billing:
            raise billing.DomainError(code=1) from error
        raise shipping.DomainError(code=2) from error
"""
        tree = PythonAstTree(source)
        issues = [issue["kind"] for issue in tree.coding_issues()]

        self.assertNotIn("duplicate-error-translation", issues)

    def test_identical_error_translations_remain_duplicates(self) -> None:
        """Responsibilities: _identical exception translation result_."""
        source = """
def handle():
    try:
        operation()
    except Exception as error:
        if use_primary:
            raise DomainError(code=1) from error
        raise DomainError(code=1) from error
"""
        tree = PythonAstTree(source)
        issues = [issue["kind"] for issue in tree.coding_issues()]

        self.assertIn("duplicate-error-translation", issues)

    def test_equivalent_error_translations_resolve_local_message_aliases(self) -> None:
        """Responsibilities: _equivalent translated error detection_."""
        source = """def load_record():
    try:
        read_record()
    except ValueError:
        if should_retry():
            retry_message = "record could not be loaded"
            raise RuntimeError(retry_message)
        fallback_message = "record could not be loaded"
        raise RuntimeError(fallback_message)
"""
        tree = PythonAstTree(source)
        issues = [issue["kind"] for issue in tree.coding_issues()]

        self.assertIn("duplicate-error-translation", issues)

    def test_reassigned_exception_alias_uses_current_binding(self) -> None:
        """Responsibilities: _exception alias reassignment_."""
        source = """
Caught = Exception
Caught = ValueError
try:
    operation()
except Caught:
    recover()
"""
        tree = PythonAstTree(source)
        issues = [issue["kind"] for issue in tree.coding_issues()]

        self.assertNotIn("broad-except", issues)

    def test_exception_aliases_are_isolated_between_functions(self) -> None:
        """Responsibilities: _lexical exception alias ownership_."""
        source = """
def broad_handler():
    Caught = Exception
    try:
        operation()
    except Caught:
        recover()

def narrow_handler():
    Caught = ValueError
    try:
        operation()
    except Caught:
        recover()
"""
        tree = PythonAstTree(source)
        issues = [issue["kind"] for issue in tree.coding_issues()]

        self.assertEqual(issues.count("broad-except"), 1)

    def test_exception_tuple_alias_replacement_drops_multiplicity(self) -> None:
        """Responsibilities: _exception tuple alias lifecycle_."""
        source = """
exceptions = (ValueError, TypeError)
try:
    operation()
except exceptions:
    recover()
exceptions = (ValueError,)
try:
    operation()
except exceptions:
    recover()
"""
        tree = PythonAstTree(source)
        issues = [issue["kind"] for issue in tree.coding_issues()]

        self.assertEqual(issues.count("python-multi-except"), 1)
