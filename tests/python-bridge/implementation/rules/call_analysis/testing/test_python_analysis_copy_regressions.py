from __future__ import annotations

import ast
import unittest
from collections import Counter

from counted_bindings_support import CountedBindings
from counting_async_completion_support import CountingAsyncCompletion
from implementation.ast.imports.python_ast_node_index import PythonAstNodeIndex
from implementation.rules.call_analysis.testing.python_test_callable_definition import (
    PythonTestCallableDefinition,
)
from implementation.rules.call_analysis.testing.python_test_execution_region import (
    PythonTestExecutionRegion,
)
from implementation.rules.call_analysis.testing.python_test_order_dependency import (
    PythonTestOrderDependency,
)
from implementation.rules.call_analysis.testing.python_unasserted_async_completion import (
    PythonUnassertedAsyncCompletion,
)


class PythonAnalysisCopyRegressionsTest(unittest.TestCase):
    """Responsibilities: _scope-copy regression checks_, _binding snapshot regression checks_."""

    def _helper_scope_scenario(self) -> ast.FunctionDef:
        """Responsibilities: _sibling helper AST fixture_."""
        helper_count = 80
        definitions = [f"    def action_{index}():\n        pass" for index in range(helper_count)]
        calls = [f"    action_{index}()" for index in range(helper_count)]
        tree = ast.parse("def test_scenario():\n" + "\n".join([*definitions, *calls]))
        test_function = tree.body[0]
        if type(test_function) is not ast.FunctionDef:
            self.fail("expected the test scenario function")
        return test_function

    def test_invoked_leaf_helpers_are_included_in_execution_region(self) -> None:
        """Responsibilities: _invoked helper execution result_."""
        test_function = self._helper_scope_scenario()
        helper_definitions = [node for node in test_function.body if type(node) is ast.FunctionDef]
        bindings: dict[str, ast.AST] = {node.name: node for node in helper_definitions}
        counted_bindings = CountedBindings(bindings, ast.parse(""))
        helper_bodies = [node.body[0] for node in helper_definitions]
        node_index = PythonAstNodeIndex()
        node_index.nodes(test_function)
        definition = PythonTestCallableDefinition(test_function, node_index)
        production_callables = definition.nested_callables()
        production_region = PythonTestExecutionRegion(test_function, production_callables, node_index)
        production_nodes = production_region.nodes
        execution_region = PythonTestExecutionRegion(test_function, counted_bindings, node_index)
        instrumented_nodes = execution_region.nodes

        self.assertEqual(
            {
                "inherited_entries_iterated": counted_bindings.iteration_count(),
                "production_helpers_executed": all(body in production_nodes for body in helper_bodies),
                "instrumented_helpers_executed": all(body in instrumented_nodes for body in helper_bodies),
            },
            {
                "inherited_entries_iterated": 0,
                "production_helpers_executed": True,
                "instrumented_helpers_executed": True,
            },
        )

    def test_execution_region_reuses_its_cached_nodes(self) -> None:
        """Responsibilities: _execution region cache reuse_."""
        test_function = self._helper_scope_scenario()
        node_index = PythonAstNodeIndex()
        node_index.nodes(test_function)
        definition = PythonTestCallableDefinition(test_function, node_index)
        callables = definition.nested_callables()
        production_region = PythonTestExecutionRegion(test_function, callables, node_index)
        production_nodes = production_region.nodes
        cached_production_nodes = production_region.nodes
        self.assertIs(production_nodes, cached_production_nodes)

    def test_execution_regions_reuse_indexed_ast_children(self) -> None:
        """Responsibilities: _cached child traversal_, _execution result preservation_."""
        tree = ast.parse(
            "def test_flow():\n    def helper():\n        return 1\n    value = helper()\n",
        )
        test_function = tree.body[0]
        node_index = PythonAstNodeIndex()
        indexed_nodes = node_index.nodes(tree)
        definition = PythonTestCallableDefinition(test_function, node_index)

        callables = definition.nested_callables()
        region = PythonTestExecutionRegion(test_function, callables, node_index)
        nodes = region.nodes

        self.assertEqual(
            {
                "helper_found": "helper" in callables,
                "execution_nodes_match_index": all(node in indexed_nodes for node in nodes),
                "helper_call_included": any(type(node) is ast.Call for node in nodes),
            },
            {"helper_found": True, "execution_nodes_match_index": True, "helper_call_included": True},
        )

    def test_order_analysis_reuses_module_bindings_across_tests(self) -> None:
        """Responsibilities: _shared module binding reuse_."""
        binding_count = 60
        test_count = 60
        assignments = [f"state_{index} = []" for index in range(binding_count)]
        test_functions = [f"def test_{index}():\n    pass" for index in range(test_count)]
        tree = ast.parse("\n\n".join([*assignments, *test_functions]))
        module_bindings = CountedBindings(
            {f"state_{index}": ast.List(elts=[], ctx=ast.Load()) for index in range(binding_count)},
            tree,
        )
        counting_order = module_bindings
        order_issues = counting_order.issues()
        production_order = PythonTestOrderDependency(tree, PythonAstNodeIndex())
        production_issues = production_order.issues()

        self.assertEqual(
            {
                "module_binding_entries_iterated": module_bindings.iteration_count(),
                "issues": order_issues,
                "production_result_matches": order_issues == production_issues,
            },
            {
                "module_binding_entries_iterated": binding_count * 2,
                "issues": [],
                "production_result_matches": True,
            },
        )

    def test_order_analysis_reports_shared_mutable_test_state(self) -> None:
        """Responsibilities: _shared test state_."""
        tree = ast.parse(
            "state = []\ndef test_first():\n    state.append(1)\ndef test_second():\n    state.append(2)\n",
        )
        node_index = PythonAstNodeIndex()
        node_index.nodes(tree)
        analysis = PythonTestOrderDependency(tree, node_index)
        issues = analysis.issues()
        first_issue = {}
        if issues:
            first_issue = issues[0]

        self.assertEqual(
            {
                "issue_count": len(issues),
                "issue_name": first_issue.get("name", ""),
            },
            {"issue_count": 1, "issue_name": "state"},
        )

    def test_async_analysis_reuses_names_across_test_functions(self) -> None:
        """Responsibilities: _shared async name reuse_."""
        binding_count = 60
        test_count = 60
        async_functions = [f"async def operation_{index}():\n    pass" for index in range(binding_count)]
        test_functions = [f"def test_{index}():\n    pass" for index in range(test_count)]
        tree = ast.parse("\n\n".join([*async_functions, *test_functions]))
        async_node_index = PythonAstNodeIndex()
        snapshots: Counter[str] = Counter()
        async_rule = CountingAsyncCompletion(async_node_index, snapshots)
        async_issues = async_rule.issues(tree)
        production_node_index = PythonAstNodeIndex()
        production_rule = PythonUnassertedAsyncCompletion(production_node_index)
        production_async_issues = production_rule.issues(tree)
        async_snapshot_count = snapshots["count"]

        self.assertEqual(
            {
                "async_module_snapshots": async_snapshot_count,
                "async_issues": async_issues,
                "production_result_matches": async_issues == production_async_issues,
            },
            {
                "async_module_snapshots": 1,
                "async_issues": [],
                "production_result_matches": True,
            },
        )
