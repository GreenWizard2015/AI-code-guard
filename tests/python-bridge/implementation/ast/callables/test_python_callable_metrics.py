import ast
import unittest

from implementation.ast.callable_nodes.python_function_selector import PythonFunctionSelector
from implementation.ast.callables.callable_metrics import CallableMetrics
from implementation.ast.imports.python_ast_node_index import PythonAstNodeIndex


class PythonCallableMetricsTest(unittest.TestCase):
    """Responsibilities: _control-flow depth calculation_, _callable scope boundaries_."""

    def test_counts_nested_control_statements(self) -> None:
        """Responsibilities: _nested control depth_."""
        tree = ast.parse(
            "def run():\n"
            "    if ready:\n"
            "        for item in items:\n"
            "            while active:\n"
            "                pass\n",
        )
        node_index = PythonAstNodeIndex()
        function_selector = PythonFunctionSelector(tree, node_index)
        functions = function_selector.nodes()
        function = functions[0]
        metrics = CallableMetrics(node_index)

        self.assertEqual(metrics.control_flow_depth(function.body), 3)

    def test_ignores_nested_callable_body_when_counting_owner(self) -> None:
        """Responsibilities: _nested callable boundary_."""
        tree = ast.parse(
            "def run():\n"
            "    if ready:\n"
            "        def nested():\n"
            "            if other:\n"
            "                if deeper:\n"
            "                    pass\n",
        )
        node_index = PythonAstNodeIndex()
        function_selector = PythonFunctionSelector(tree, node_index)
        functions = function_selector.nodes()
        function = functions[0]
        nested = functions[1]
        metrics = CallableMetrics(node_index)

        self.assertEqual(
            (metrics.control_flow_depth(function.body), metrics.control_flow_depth(nested.body)),
            (1, 2),
        )
