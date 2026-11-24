from __future__ import annotations

import ast
import unittest
from collections import Counter

from counted_bindings_support import CountedBindings
from counting_async_completion_support import CountingAsyncCompletion
from implementation.ast.callable_nodes.python_function_selector import (
    PythonFunctionSelector,
)
from implementation.ast.imports.python_ast_node_index import PythonAstNodeIndex
from implementation.ast.protocols import PythonFunctionNode
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
    """Responsibilities: _execution region coverage_, _binding snapshot access_."""

    def _helper_bindings(self, test_function: PythonFunctionNode) -> CountedBindings:
        """Responsibilities: _helper callable binding_, _binding access_."""
        helper_tree = ast.Module(body=[test_function], type_ignores=[])
        helper_selector = PythonFunctionSelector(helper_tree, PythonAstNodeIndex())
        selected_helpers = helper_selector.nodes()
        helper_definitions = selected_helpers[1:]
        bindings: dict[str, ast.AST] = {node.name: node for node in helper_definitions}
        return CountedBindings(bindings, ast.parse(""))

    def _helper_bodies(self, test_function: PythonFunctionNode) -> list[ast.AST]:
        """Responsibilities: _sibling helper body selection_."""
        helper_tree = ast.Module(body=[test_function], type_ignores=[])
        helper_selector = PythonFunctionSelector(helper_tree, PythonAstNodeIndex())
        helper_functions = helper_selector.nodes()
        helper_definitions = helper_functions[1:]
        return [node.body[0] for node in helper_definitions]

    def _helper_scope_scenario(self) -> PythonFunctionNode:
        """Responsibilities: _sibling helper source generation_."""
        helper_count = 80
        definitions = [f"    def action_{index}():\n        pass" for index in range(helper_count)]
        calls = [f"    action_{index}()" for index in range(helper_count)]
        tree = ast.parse("def test_scenario():\n" + "\n".join([*definitions, *calls]))
        node_index = PythonAstNodeIndex()
        function_selector = PythonFunctionSelector(tree, node_index)
        functions = function_selector.nodes()
        return functions[0]

    def test_invoked_leaf_helpers_are_included_in_execution_region(self) -> None:
        """Responsibilities: _invoked helper execution result_."""
        test_function = self._helper_scope_scenario()
        counted_bindings = self._helper_bindings(test_function)
        helper_bodies = self._helper_bodies(test_function)
        node_index = PythonAstNodeIndex()
        node_index.nodes(test_function)
        definition = PythonTestCallableDefinition(test_function, node_index)
        production_callables = definition.nested_callables()
        production_region = PythonTestExecutionRegion(test_function, production_callables, node_index)
        instrumented_region = PythonTestExecutionRegion(test_function, counted_bindings, node_index)
        production_nodes = production_region.nodes
        instrumented_nodes = instrumented_region.nodes

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
        node_index = PythonAstNodeIndex()
        indexed_nodes = node_index.nodes(tree)
        function_selector = PythonFunctionSelector(tree, node_index)
        functions = function_selector.nodes()
        test_function = functions[0]
        definition = PythonTestCallableDefinition(test_function, node_index)

        callables = definition.nested_callables()
        region = PythonTestExecutionRegion(test_function, callables, node_index)
        nodes = region.nodes

        self.assertEqual(
            {
                "helper_found": "helper" in callables,
                "execution_nodes_match_index": all(node in indexed_nodes for node in nodes),
                "helper_call_included": "helper()" in [ast.unparse(node) for node in nodes],
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
