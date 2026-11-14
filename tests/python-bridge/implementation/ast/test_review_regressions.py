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

    def test_nested_async_call_is_checked_but_awaited_call_is_not(self) -> None:
        """Responsibilities: _nested async completion result_."""
        source = """
def test_unobserved():
    async def fetch():
        return 1
    fetch()
    assert True

async def test_observed():
    async def fetch():
        return 1
    await fetch()
    assert True
"""
        tree = PythonAstTree(source)
        issues = [issue["kind"] for issue in tree.coding_issues()]

        self.assertEqual(issues.count("unasserted-async-completion"), 1)

    def test_imported_clock_alias_is_a_test_time_dependency(self) -> None:
        """Responsibilities: _aliased clock dependency detection_."""
        source = """import time as clock

def test_reads_the_real_clock():
    current_time = clock.time()
    assert current_time >= 0
"""
        tree = PythonAstTree(source)
        issues = [issue["kind"] for issue in tree.coding_issues()]

        self.assertIn("test-time-dependency", issues)

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
