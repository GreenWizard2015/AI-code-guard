from __future__ import annotations

import unittest

from implementation.ast.python_ast_tree import PythonAstTree


class AsyncAnalysisRegressionTest(unittest.TestCase):
    """Responsibilities: _async callable identity_, _nested test execution state_."""

    def test_sync_local_shadow_is_not_async_completion(self) -> None:
        """Responsibilities: _async callable shadowing result_."""
        source = """
async def fetch():
    return 1

def test_result():
    def fetch():
        return 2
    fetch()
"""
        tree = PythonAstTree(source)
        issues = [issue["kind"] for issue in tree.coding_issues()]

        self.assertNotIn("unasserted-async-completion", issues)

    def test_local_async_alias_remains_async(self) -> None:
        """Responsibilities: _async alias behavior result_."""
        source = """
async def fetch():
    return 1

def test_result():
    pending = fetch
    pending()
"""
        tree = PythonAstTree(source)
        issues = [issue["kind"] for issue in tree.coding_issues()]

        self.assertIn("unasserted-async-completion", issues)

    def test_local_shadowing_does_not_hide_async_calls_in_sibling_tests(self) -> None:
        """Responsibilities: _async callable binding isolation_."""
        source = """
async def fetch():
    return 1

def test_sync_shadow():
    def fetch():
        return 2
    fetch()
    assert True

def test_async_call():
    fetch()
    assert True
"""
        tree = PythonAstTree(source)
        issues = [issue["kind"] for issue in tree.coding_issues()]

        self.assertEqual(issues.count("unasserted-async-completion"), 1)

    def test_module_callable_reassignment_replaces_async_identity(self) -> None:
        """Responsibilities: _module callable reassignment result_."""
        source = """
async def fetch():
    return 1

def fetch():
    return 2

def test_result():
    fetch()
    assert True
"""
        tree = PythonAstTree(source)
        issues = [issue["kind"] for issue in tree.coding_issues()]

        self.assertNotIn("unasserted-async-completion", issues)

    def test_nested_uninvoked_helper_has_no_test_effects(self) -> None:
        """Responsibilities: _deferred test helper result_."""
        source = """
import time
async def fetch():
    return 1

def test_result():
    def later():
        fetch()
        time.time()
    self.assertTrue(True)
"""
        tree = PythonAstTree(source)
        issues = [issue["kind"] for issue in tree.coding_issues()]

        self.assertFalse({"unasserted-async-completion", "test-time-dependency"}.intersection(issues))

    def test_invoked_nested_helper_contributes_test_effects(self) -> None:
        """Responsibilities: _invoked helper effects_."""
        source = """
async def fetch():
    return 1

def test_result():
    def later():
        fetch()
        return 1
    later()
"""
        tree = PythonAstTree(source)
        issues = [issue["kind"] for issue in tree.coding_issues()]

        self.assertIn("unasserted-async-completion", issues)

    def test_uninvoked_nested_helpers_do_not_share_test_state(self) -> None:
        """Responsibilities: _deferred shared-state effects_."""
        source = """
shared = []
def test_first():
    def later():
        shared.append(1)

def test_second():
    def later():
        shared.append(2)
"""
        tree = PythonAstTree(source)
        issues = [issue["kind"] for issue in tree.coding_issues()]

        self.assertNotIn("test-order-dependency", issues)


class CacheStateRegressionTest(unittest.TestCase):
    """Responsibilities: _cache operation ordering_, _branch cache state_."""

    def test_nested_cache_read_precedes_following_write(self) -> None:
        """Responsibilities: _cache operation execution order_."""
        source = """
def load(cache, lock):
    with lock:
        cache.get("read")
    cache.set("write", 1)
"""
        tree = PythonAstTree(source)
        issues = [issue["kind"] for issue in tree.coding_issues()]

        self.assertIn("incomplete-cache-key", issues)

    def test_nested_cache_read_executes_before_outer_write(self) -> None:
        """Responsibilities: _nested cache access ordering_."""
        source = """
def load(cache):
    cache.set("write", cache.get("read"))
"""
        tree = PythonAstTree(source)
        issues = [issue["kind"] for issue in tree.coding_issues()]

        self.assertIn("incomplete-cache-key", issues)

    def test_mutually_exclusive_cache_read_and_write_are_not_paired(self) -> None:
        """Responsibilities: _cache branch effect ownership_."""
        source = """
def load(cache, should_read):
    if should_read:
        cache.get("read")
    else:
        cache.set("write", 1)
"""
        tree = PythonAstTree(source)
        issues = [issue["kind"] for issue in tree.coding_issues()]

        self.assertNotIn("incomplete-cache-key", issues)

    def test_cache_read_on_one_branch_is_compared_with_following_write(self) -> None:
        """Responsibilities: _branch cache state merge_."""
        source = """
def load(cache, should_read):
    if should_read:
        cache.get("read")
    cache.set("write", 1)
"""
        tree = PythonAstTree(source)
        issues = [issue["kind"] for issue in tree.coding_issues()]

        self.assertIn("incomplete-cache-key", issues)


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
