from __future__ import annotations

import ast
import unittest
from collections.abc import Iterable, Iterator, Mapping

from implementation.ast.python_ast_node_index import PythonAstNodeIndex
from implementation.protocols import PythonAstNodeIndexContract
from implementation.rules.call_analysis.testing.python_test_execution_region import (
    PythonTestExecutionRegion,
)
from implementation.rules.call_analysis.testing.python_test_order_dependency import (
    PythonTestOrderDependency,
)
from implementation.rules.call_analysis.testing.python_unasserted_async_completion import (
    PythonUnassertedAsyncCompletion,
)


class CountedBindings(Mapping[str, ast.AST]):
    """Responsibilities: _binding lookup_, _iteration cost observation_, _binding count_."""

    def __init__(self, bindings: dict[str, ast.AST]) -> None:
        """Responsibilities: _binding fixture initialization_."""
        self.bindings: Mapping[str, ast.AST] = bindings
        self._metrics: dict[str, int] = {"iterated_entries": 0}

    def __getitem__(self, name: str) -> ast.AST:
        """Responsibilities: _binding lookup_."""
        return self.bindings[name]

    def __iter__(self) -> Iterator[str]:
        """Responsibilities: _binding iteration count_."""
        self._metrics["iterated_entries"] += len(self.bindings)
        return iter(self.bindings)

    def __len__(self) -> int:
        """Responsibilities: _binding count lookup_."""
        return len(self.bindings)

    def iteration_count(self) -> int:
        """Responsibilities: _binding iteration measurement_."""
        return self._metrics["iterated_entries"]


class CountingExecutionRegion(PythonTestExecutionRegion):
    """Responsibilities: _callable scope metrics_, _analysis operation metrics_."""

    def __init__(self, function: ast.AST, bindings: CountedBindings) -> None:
        """Responsibilities: _scope instrumentation initialization_."""
        super().__init__(function)
        self.bindings: CountedBindings = bindings

    def _nested_callables(self, function: ast.AST) -> Mapping[str, ast.AST]:
        """Responsibilities: _instrumented root callable scope_."""
        if type(function) is ast.FunctionDef and function.name == "test_scenario":
            return self.bindings
        return {}


class CountingTestOrderDependency(PythonTestOrderDependency):
    """Responsibilities: _module binding metrics_, _test analysis metrics_."""

    def __init__(self, tree: ast.Module, bindings: CountedBindings) -> None:
        """Responsibilities: _module binding fixture initialization_."""
        super().__init__(tree)
        self.bindings: CountedBindings = bindings

    def module_mutable_objects(self) -> Mapping[str, ast.AST]:
        """Responsibilities: _instrumented module bindings_."""
        return self.bindings


class CountedAsyncNames(set[str]):
    """Responsibilities: _async name membership_, _difference cost measurement_."""

    def __init__(self, names: set[str]) -> None:
        """Responsibilities: _async name instrumentation initialization_."""
        super().__init__(names)
        self._metrics: dict[str, int] = {"difference_calls": 0}

    def difference(self, *others: Iterable[str]) -> set[str]:
        """Responsibilities: _difference cost tracking_."""
        self._metrics["difference_calls"] += 1
        return super().difference(*others)

    def difference_count(self) -> int:
        """Responsibilities: _difference operation measurement_."""
        return self._metrics["difference_calls"]


class CountingAsyncCompletion(PythonUnassertedAsyncCompletion):
    """Responsibilities: _async name instrumentation_, _completion result comparison_."""

    def __init__(self, node_index: PythonAstNodeIndexContract) -> None:
        """Responsibilities: _async analysis instrumentation initialization_."""
        super().__init__(node_index)
        self.counted_names: CountedAsyncNames = CountedAsyncNames(set())

    def module_async_names(self, tree: ast.Module) -> CountedAsyncNames:
        """Responsibilities: _instrumented async module names_."""
        self.counted_names.update(super().module_async_names(tree))
        return self.counted_names


class PythonAnalysisCopyRegressionsTest(unittest.TestCase):
    """Responsibilities: _scope-copy regression checks_, _binding snapshot regression checks_."""

    def test_invoked_leaf_helpers_reuse_sibling_callable_scope(self) -> None:
        """Responsibilities: _linear helper scope construction_."""
        helper_count = 80
        definitions = [
            f"    def action_{index}():\n        pass" for index in range(helper_count)
        ]
        calls = [f"    action_{index}()" for index in range(helper_count)]
        tree = ast.parse("def test_scenario():\n" + "\n".join([*definitions, *calls]))
        test_function = tree.body[0]
        bindings = {
            node.name: node
            for node in test_function.body
            if type(node) is ast.FunctionDef
        }
        counted_bindings = CountedBindings(bindings)
        execution_region = CountingExecutionRegion(test_function, counted_bindings)
        executed_nodes = execution_region.nodes()
        production_region = PythonTestExecutionRegion(test_function)
        production_nodes = production_region.nodes()
        cached_production_nodes = production_region.nodes()
        helper_bodies = [node.body[0] for node in bindings.values()]

        self.assertEqual(
            {
                "inherited_entries_iterated": counted_bindings.iteration_count(),
                "all_helper_bodies_executed": all(
                    body in executed_nodes for body in helper_bodies
                ),
                "production_region_cache_reused": production_nodes
                is cached_production_nodes,
            },
            {
                "inherited_entries_iterated": 0,
                "all_helper_bodies_executed": True,
                "production_region_cache_reused": True,
            },
        )

    def test_order_analysis_reuses_module_bindings_across_tests(self) -> None:
        """Responsibilities: _shared module binding reuse_."""
        binding_count = 60
        test_count = 60
        assignments = [f"state_{index} = []" for index in range(binding_count)]
        test_functions = [
            f"def test_{index}():\n    pass" for index in range(test_count)
        ]
        tree = ast.parse("\n\n".join([*assignments, *test_functions]))
        module_bindings = CountedBindings(
            {
                f"state_{index}": ast.List(elts=[], ctx=ast.Load())
                for index in range(binding_count)
            }
        )
        counting_order = CountingTestOrderDependency(tree, module_bindings)
        order_issues = counting_order.issues()
        production_order = PythonTestOrderDependency(tree)
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

    def test_async_analysis_reuses_names_across_test_functions(self) -> None:
        """Responsibilities: _shared async name reuse_."""
        binding_count = 60
        test_count = 60
        async_functions = [
            f"async def operation_{index}():\n    pass"
            for index in range(binding_count)
        ]
        test_functions = [
            f"def test_{index}():\n    pass" for index in range(test_count)
        ]
        tree = ast.parse("\n\n".join([*async_functions, *test_functions]))
        async_node_index = PythonAstNodeIndex()
        async_rule = CountingAsyncCompletion(async_node_index)
        async_issues = async_rule.issues(tree)
        production_node_index = PythonAstNodeIndex()
        production_rule = PythonUnassertedAsyncCompletion(production_node_index)
        production_async_issues = production_rule.issues(tree)
        async_names = async_rule.counted_names
        async_difference_calls = async_names.difference_count()

        self.assertEqual(
            {
                "async_name_difference_calls": async_difference_calls,
                "async_issues": async_issues,
                "production_result_matches": async_issues == production_async_issues,
            },
            {
                "async_name_difference_calls": 0,
                "async_issues": [],
                "production_result_matches": True,
            },
        )
